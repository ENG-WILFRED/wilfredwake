# Service Status Logic

## Overview
The wilfredwake orchestrator uses a simple but effective status determination logic:

**Any HTTP response = Service is LIVE (responsive)**  
**No response / Timeout = Service is DEAD (needs waking)**

## Detailed Logic

### LIVE Status ✓
Service receives a response from any HTTP status code:
- **200 OK** - Service is fully operational
- **404 Not Found** - Service is up but endpoint doesn't exist (still responsive)
- **500 Server Error** - Service is up but has an error (still responsive)
- **503 Service Unavailable** - Service responded with service unavailable (still responsive)
- Any other 2xx, 3xx, 4xx, 5xx status code

### DEAD Status ⚫
Service receives no response:
- **Timeout** - Service didn't respond within 10 seconds
- **ECONNREFUSED** - Connection refused (service not running)
- **ENOTFOUND** - DNS/host not found
- **Network Error** - Any connection error

## Real Service Examples

### Backend Service
```
URL: https://pension-backend-rs4h.onrender.com
Health: /api/health
Status: Returns 200 OK → LIVE ✓
```

### Frontend Service
```
URL: https://transactions-k6gk.onrender.com
Health: /health
Status: Returns 404 Not Found → LIVE ✓
(Service is responsive even though /health doesn't exist)
```

### Payment Gateway
```
URL: https://payment-gateway-7eta.onrender.com
Health: /health
Status: Returns 200 OK → LIVE ✓
```

### Notification Consumer
```
URL: https://notification-service-consumer.onrender.com
Health: /
Status: Timeout (no response) → DEAD ⚫
(Needs to be woken up)
```

### Notification Producer
```
URL: https://notification-service-producer.onrender.com
Health: /health
Status: Timeout (no response) → DEAD ⚫
(Needs to be woken up)
```

## Why This Works

1. **Simple & Effective**: Any response means the service is running and can handle requests
2. **No False Negatives**: We don't incorrectly mark a running service as dead
3. **Catches Real Issues**: If a service doesn't respond at all, it's definitely not operational
4. **5-Minute Monitoring**: After wake completes, the CLI polls every 10 seconds for 5 minutes to show live trends as services come up

## Behavior in wilfredwake wake

When you run `wilfredwake wake`:

1. **Initial Wake**: Services marked as DEAD initially, health checks start
2. **Response Check**: Any response = marked LIVE immediately
3. **No Response**: Service = marked DEAD, needs waking
4. **5-Minute Monitoring**: Real-time status table updates every 10 seconds
5. **Live Count Updates**: Watch services transition from DEAD → LIVE as they respond

## Test Results

All 17 tests pass, including:
- ✅ 200 responses marked as LIVE
- ✅ 404 responses marked as LIVE
- ✅ Timeout scenarios marked as DEAD
- ✅ All real production service URLs tested
