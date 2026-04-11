#!/usr/bin/env bash
set -euo pipefail

SUPABASE_URL="https://trwdqzsfgeydafojajbh.supabase.co"
SK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyd2RxenNmZ2V5ZGFmb2phamJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI1NTU4NiwiZXhwIjoyMDkwODMxNTg2fQ.BsT8WxBigJfhlr4IXiN2VcG7iP8lcIqk5DEiQixllwU"
GOOGLE_API_KEY="AIzaSyDTubcLiMJpNHVmZKJDxTzyQFtpq5NZHb4"
RATE_LIMIT_MS=100

# City -> state mapping for Google Places search
declare -A STATE_MAP
STATE_MAP["Miami"]="FL"
STATE_MAP["New York"]="NY"
STATE_MAP["Los Angeles"]="CA"
STATE_MAP["Chicago"]="IL"
STATE_MAP["San Francisco"]="CA"

# Price level mapping
declare -A PRICE_MAP
PRICE_MAP["PRICE_LEVEL_FREE"]=1
PRICE_MAP["PRICE_LEVEL_INEXPENSIVE"]=1
PRICE_MAP["PRICE_LEVEL_MODERATE"]=2
PRICE_MAP["PRICE_LEVEL_EXPENSIVE"]=3
PRICE_MAP["PRICE_LEVEL_VERY_EXPENSIVE"]=4

FIELD_MASK="places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.nationalPhoneNumber,places.websiteUri,places.photos,places.googleMapsUri,places.editorialSummary"

# Fetch all restaurants without google_place_id
echo "Fetching restaurants to enrich..."
restaurants=$(curl -s \
  "${SUPABASE_URL}/rest/v1/restaurants?google_place_id=is.null&select=id,name,city&order=city&limit=1000" \
  -H "apikey: ${SK}" \
  -H "Authorization: Bearer ${SK}")

count=$(echo "$restaurants" | jq 'length')
echo "Found $count restaurants to enrich"

ENRICHED=0
FAILED=0

for ((i=0; i<count; i++)); do
  id=$(echo "$restaurants" | jq -r ".[$i].id")
  name=$(echo "$restaurants" | jq -r ".[$i].name")
  city=$(echo "$restaurants" | jq -r ".[$i].city")
  state="${STATE_MAP[$city]:-}"

  # Search Google Places
  search_query="${name} restaurant ${city}, ${state}"
  place_response=$(curl -s -X POST \
    "https://places.googleapis.com/v1/places:searchText" \
    -H "Content-Type: application/json" \
    -H "X-Goog-Api-Key: ${GOOGLE_API_KEY}" \
    -H "X-Goog-FieldMask: ${FIELD_MASK}" \
    -d "{\"textQuery\": \"${search_query}\", \"maxResultCount\": 1}")

  # Check if we got a result
  has_places=$(echo "$place_response" | jq 'has("places") and (.places | length > 0)')

  if [ "$has_places" != "true" ]; then
    echo "  [$((i+1))/$count] No result: $name ($city)"
    FAILED=$((FAILED + 1))
    sleep 0.1
    continue
  fi

  place=$(echo "$place_response" | jq '.places[0]')

  # Extract fields
  place_id=$(echo "$place" | jq -r '.id // empty')
  address=$(echo "$place" | jq -r '.formattedAddress // empty')
  lat=$(echo "$place" | jq -r '.location.latitude // empty')
  lng=$(echo "$place" | jq -r '.location.longitude // empty')
  rating=$(echo "$place" | jq -r '.rating // empty')
  review_count=$(echo "$place" | jq -r '.userRatingCount // 0')
  price_level=$(echo "$place" | jq -r '.priceLevel // empty')
  phone=$(echo "$place" | jq -r '.nationalPhoneNumber // empty')
  website=$(echo "$place" | jq -r '.websiteUri // empty')
  maps_url=$(echo "$place" | jq -r '.googleMapsUri // empty')
  description=$(echo "$place" | jq -r '.editorialSummary.text // empty')

  # Photo URL
  photo_name=$(echo "$place" | jq -r '.photos[0].name // empty')
  photo_url=""
  if [ -n "$photo_name" ]; then
    photo_url="https://places.googleapis.com/v1/${photo_name}/media?maxWidthPx=800&key=${GOOGLE_API_KEY}"
  fi

  # Extract cuisine from types
  cuisine=$(echo "$place" | jq -r '
    (.types // []) |
    map(select(contains("restaurant") or contains("food") or contains("cafe") or contains("bakery") or contains("bar"))) |
    first // "Restaurant" |
    gsub("_restaurant"; "") |
    gsub("_food"; "") |
    gsub("_"; " ") |
    split(" ") | map(.[0:1] | ascii_upcase + .[1:]) | join(" ")
  ')

  # Map price level
  price_range=2
  if [ -n "$price_level" ] && [ "${PRICE_MAP[$price_level]+exists}" ]; then
    price_range=${PRICE_MAP[$price_level]}
  fi

  # Build update JSON
  update_json=$(jq -n \
    --arg place_id "$place_id" \
    --arg address "$address" \
    --arg lat "$lat" \
    --arg lng "$lng" \
    --arg rating "$rating" \
    --arg review_count "$review_count" \
    --arg price_range "$price_range" \
    --arg phone "$phone" \
    --arg website "$website" \
    --arg maps_url "$maps_url" \
    --arg photo_url "$photo_url" \
    --arg cuisine "$cuisine" \
    --arg description "$description" \
    --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{
      google_place_id: $place_id,
      address: (if $address != "" then $address else null end),
      latitude: (if $lat != "" then ($lat | tonumber) else null end),
      longitude: (if $lng != "" then ($lng | tonumber) else null end),
      google_rating: (if $rating != "" then ($rating | tonumber) else null end),
      google_review_count: ($review_count | tonumber),
      price_range: ($price_range | tonumber),
      phone: (if $phone != "" then $phone else null end),
      website: (if $website != "" then $website else null end),
      google_url: (if $maps_url != "" then $maps_url else null end),
      google_photo_url: (if $photo_url != "" then $photo_url else null end),
      photo_url: (if $photo_url != "" then $photo_url else null end),
      cuisine: (if $cuisine != "" and $cuisine != "Restaurant" then $cuisine else null end),
      description: (if $description != "" then $description else null end),
      last_fetched_at: $now
    } | with_entries(select(.value != null))')

  # Update restaurant
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PATCH "${SUPABASE_URL}/rest/v1/restaurants?id=eq.${id}" \
    -H "apikey: ${SK}" \
    -H "Authorization: Bearer ${SK}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$update_json")

  if [ "$http_code" = "204" ]; then
    ENRICHED=$((ENRICHED + 1))
    if [ $((ENRICHED % 25)) -eq 0 ]; then
      echo "  Progress: $ENRICHED/$count enriched"
    fi
  else
    echo "  [$((i+1))/$count] Update failed ($http_code): $name"
    FAILED=$((FAILED + 1))
  fi

  # Rate limit
  sleep 0.1
done

echo ""
echo "=== Enrichment complete: $ENRICHED enriched, $FAILED failed ==="
