#!/usr/bin/env bash
set -euo pipefail

SUPABASE_URL="https://trwdqzsfgeydafojajbh.supabase.co"
SK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyd2RxenNmZ2V5ZGFmb2phamJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI1NTU4NiwiZXhwIjoyMDkwODMxNTg2fQ.BsT8WxBigJfhlr4IXiN2VcG7iP8lcIqk5DEiQixllwU"
SEED_FILE="./gastronome-seed-data-with-accolades.json"

if [ ! -f "$SEED_FILE" ]; then
  echo "ERROR: Seed file not found: $SEED_FILE"
  exit 1
fi

# City key -> DB city name mapping
declare -A CITY_MAP
CITY_MAP[Miami]="Miami"
CITY_MAP[NYC]="New York"
CITY_MAP[LA]="Los Angeles"
CITY_MAP[Chicago]="Chicago"
CITY_MAP[SF]="San Francisco"

TOTAL=0
ERRORS=0

for city_key in Miami NYC LA Chicago SF; do
  db_city="${CITY_MAP[$city_key]}"
  count=$(jq -r ".[\"$city_key\"] | length" "$SEED_FILE")
  echo "Processing $city_key ($db_city): $count restaurants"

  # Transform the city's restaurants into Supabase-ready JSON, 50 at a time
  batch_size=50
  for ((i=0; i<count; i+=batch_size)); do
    end=$((i + batch_size))
    if [ $end -gt $count ]; then end=$count; fi

    # Use jq to transform the batch
    payload=$(jq -c "[.[\"$city_key\"][$i:$end] | .[] | {
      name: .name,
      city: \"$db_city\",
      cuisine: \"Restaurant\",
      price_range: 2,
      michelin_stars: (
        if (.accolades // [] | map(select(contains(\"Michelin 3 Star\"))) | length > 0) then 3
        elif (.accolades // [] | map(select(contains(\"Michelin 2 Star\"))) | length > 0) then 2
        elif (.accolades // [] | map(select(contains(\"Michelin 1 Star\"))) | length > 0) then 1
        else 0 end
      ),
      michelin_designation: (
        if (.accolades // [] | map(select(contains(\"Michelin 3 Star\"))) | length > 0) then \"three_star\"
        elif (.accolades // [] | map(select(contains(\"Michelin 2 Star\"))) | length > 0) then \"two_star\"
        elif (.accolades // [] | map(select(contains(\"Michelin 1 Star\"))) | length > 0) then \"one_star\"
        elif (.accolades // [] | map(select(contains(\"Bib Gourmand\"))) | length > 0) then \"bib_gourmand\"
        else null end
      ),
      james_beard_winner: ((.accolades // []) | map(select(startswith(\"James Beard\"))) | length > 0),
      james_beard_nominated: ((.accolades // []) | map(select(startswith(\"James Beard\"))) | length > 0),
      eater_38: ((.lists // []) | map(select(contains(\"Essential 38\"))) | length > 0),
      is_featured: (
        (.accolades // [] | map(select(contains(\"Michelin 2 Star\") or contains(\"Michelin 3 Star\"))) | length > 0) or
        ((.accolades // []) | map(select(startswith(\"James Beard\"))) | length > 0)
      ),
      accolades: [
        (if (.accolades // [] | map(select(contains(\"Michelin\"))) | length > 0) then
          {type: \"michelin\",
           designation: (
             if (.accolades | map(select(contains(\"3 Star\"))) | length > 0) then \"three_star\"
             elif (.accolades | map(select(contains(\"2 Star\"))) | length > 0) then \"two_star\"
             elif (.accolades | map(select(contains(\"1 Star\"))) | length > 0) then \"one_star\"
             elif (.accolades | map(select(contains(\"Bib Gourmand\"))) | length > 0) then \"bib_gourmand\"
             else \"recommended\" end
           ),
           stars: (
             if (.accolades | map(select(contains(\"3 Star\"))) | length > 0) then 3
             elif (.accolades | map(select(contains(\"2 Star\"))) | length > 0) then 2
             elif (.accolades | map(select(contains(\"1 Star\"))) | length > 0) then 1
             else 0 end
           )}
        else empty end),
        ((.accolades // [])[] | select(startswith(\"James Beard\")) |
          {type: \"james_beard\",
           award: (gsub(\"James Beard \"; \"\") | gsub(\" \\\\(\\\\d+\\\\)\"; \"\")),
           year: (capture(\"\\\\((?<y>\\\\d+)\\\\)\") | .y | tonumber)})
      ]
    }]" "$SEED_FILE")

    # POST to Supabase
    http_code=$(curl -s -o /tmp/seed_response.json -w "%{http_code}" \
      -X POST "${SUPABASE_URL}/rest/v1/restaurants" \
      -H "apikey: ${SK}" \
      -H "Authorization: Bearer ${SK}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" \
      -d "$payload")

    if [ "$http_code" = "201" ]; then
      batch_count=$((end - i))
      TOTAL=$((TOTAL + batch_count))
      echo "  Inserted $city_key: $end/$count"
    else
      echo "  ERROR ($http_code) for $city_key batch $i-$end:"
      cat /tmp/seed_response.json
      echo ""
      ERRORS=$((ERRORS + (end - i)))
    fi
  done
done

echo ""
echo "=== Seed complete: $TOTAL inserted, $ERRORS errors ==="

# Update city restaurant counts
echo ""
echo "Updating city counts..."
for city_key in Miami NYC LA Chicago SF; do
  db_city="${CITY_MAP[$city_key]}"
  count=$(curl -s -H "apikey: ${SK}" -H "Authorization: Bearer ${SK}" \
    -H "Prefer: count=exact" -I \
    "${SUPABASE_URL}/rest/v1/restaurants?city=eq.${db_city// /%20}&select=id" \
    2>/dev/null | grep -i content-range | sed 's/.*\///')

  curl -s -o /dev/null -X PATCH \
    "${SUPABASE_URL}/rest/v1/cities?name=eq.${db_city// /%20}" \
    -H "apikey: ${SK}" \
    -H "Authorization: Bearer ${SK}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"restaurant_count\": ${count:-0}}"

  echo "  $db_city: ${count:-0} restaurants"
done

echo ""
echo "Done!"
