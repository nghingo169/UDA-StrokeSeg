# Backend tests

Môi trường mục tiêu (theo test plan): FastAPI + JWT, Redis/RabbitMQ, AI workers.

## Nhánh
* `api-gateway/` - HTTP endpoints & guards
* `event-bus/` - intake, queue, circuit breaker, WS fanout
* `workers/` - inference, volumetry, PDF signing
