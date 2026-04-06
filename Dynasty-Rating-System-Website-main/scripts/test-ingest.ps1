param(
  [string]$ApiBase = 'http://localhost:4000'
)

function Invoke-TestWebsitePurchaseExisting {
  param(
    [string]$Nickname = 'Leonradon21418297',
    [int]$Amount = 120
  )

  $payload = @{
    orderId = "test-website-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    nickname = $Nickname
    amount = $Amount
    items = @('Website Test Order')
  }

  Invoke-RestMethod -Method Post -Uri "$ApiBase/ingest/website" -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Depth 5)
}

function Invoke-TestTelegramPurchaseNew {
  param(
    [string]$Nickname = 'randomuser4567898765',
    [int]$Amount = 240
  )

  $payload = @{
    orderId = "test-telegram-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    nickname = $Nickname
    amount = $Amount
    phone = '+1-555-0101'
    items = @('Telegram Test Order')
  }

  Invoke-RestMethod -Method Post -Uri "$ApiBase/ingest/telegram" -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Depth 5)
}

Write-Host "Posting website purchase for existing user..."
Invoke-TestWebsitePurchaseExisting

Write-Host "Posting telegram purchase for new user..."
Invoke-TestTelegramPurchaseNew
