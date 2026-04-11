#!/usr/bin/env bash
set -euo pipefail

SUPABASE_URL="https://trwdqzsfgeydafojajbh.supabase.co"
SK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyd2RxenNmZ2V5ZGFmb2phamJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI1NTU4NiwiZXhwIjoyMDkwODMxNTg2fQ.BsT8WxBigJfhlr4IXiN2VcG7iP8lcIqk5DEiQixllwU"
GOOGLE_API_KEY="AIzaSyDTubcLiMJpNHVmZKJDxTzyQFtpq5NZHb4"

# City -> state mapping
declare -A STATE_MAP
STATE_MAP["Miami"]="FL"
STATE_MAP["New York"]="NY"
STATE_MAP["Los Angeles"]="CA"
STATE_MAP["Chicago"]="IL"
STATE_MAP["San Francisco"]="CA"

echo "Fetching restaurants with broken cuisine data..."
restaurants=$(curl -s \
  "${SUPABASE_URL}/rest/v1/restaurants?select=id,name,city,google_place_id&order=city&limit=1000" \
  -H "apikey: ${SK}" \
  -H "Authorization: Bearer ${SK}")

count=$(echo "$restaurants" | jq 'length')
echo "Found $count restaurants to fix cuisine"

FIXED=0
FAILED=0

for ((i=0; i<count; i++)); do
  id=$(echo "$restaurants" | jq -r ".[$i].id")
  name=$(echo "$restaurants" | jq -r ".[$i].name")
  city=$(echo "$restaurants" | jq -r ".[$i].city")
  place_id=$(echo "$restaurants" | jq -r ".[$i].google_place_id // empty")
  state="${STATE_MAP[$city]:-}"

  # Use Place Details if we have a place_id, otherwise text search
  if [ -n "$place_id" ]; then
    place_response=$(curl -s \
      "https://places.googleapis.com/v1/places/${place_id}" \
      -H "X-Goog-Api-Key: ${GOOGLE_API_KEY}" \
      -H "X-Goog-FieldMask: types")

    types_array=$(echo "$place_response" | jq -r '.types // []')
  else
    search_query="${name} restaurant ${city}, ${state}"
    place_response=$(curl -s -X POST \
      "https://places.googleapis.com/v1/places:searchText" \
      -H "Content-Type: application/json" \
      -H "X-Goog-Api-Key: ${GOOGLE_API_KEY}" \
      -H "X-Goog-FieldMask: places.types" \
      -d "{\"textQuery\": \"${search_query}\", \"maxResultCount\": 1}")

    has_places=$(echo "$place_response" | jq 'has("places") and (.places | length > 0)')
    if [ "$has_places" != "true" ]; then
      FAILED=$((FAILED + 1))
      sleep 0.05
      continue
    fi
    types_array=$(echo "$place_response" | jq -r '.places[0].types // []')
  fi

  # Extract cuisine with the FIXED title-case logic
  cuisine=$(echo "$types_array" | jq -r '
    map(select(contains("restaurant") or contains("food") or contains("cafe") or contains("bakery") or contains("bar"))) |
    if length == 0 then "Restaurant"
    else first |
      gsub("_restaurant"; "") |
      gsub("_food"; "") |
      gsub("_"; " ") |
      split(" ") | map( (.[0:1] | ascii_upcase) + .[1:] ) | join(" ")
    end
  ')

  # Skip if still generic or empty
  if [ -z "$cuisine" ] || [ "$cuisine" = "Restaurant" ] || [ "$cuisine" = "null" ]; then
    sleep 0.05
    continue
  fi

  # Update
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PATCH "${SUPABASE_URL}/rest/v1/restaurants?id=eq.${id}" \
    -H "apikey: ${SK}" \
    -H "Authorization: Bearer ${SK}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"cuisine\": \"${cuisine}\"}")

  if [ "$http_code" = "204" ]; then
    FIXED=$((FIXED + 1))
    if [ $((FIXED % 50)) -eq 0 ]; then
      echo "  Progress: $FIXED/$count fixed"
    fi
  else
    echo "  [$((i+1))/$count] Update failed ($http_code): $name -> $cuisine"
    FAILED=$((FAILED + 1))
  fi

  sleep 0.05
done

echo ""
echo "=== Cuisine fix complete: $FIXED fixed, $FAILED failed ==="
