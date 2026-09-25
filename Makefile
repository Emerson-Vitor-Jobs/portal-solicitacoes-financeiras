# Atalhos opcionais: tudo aqui é só docker compose (o README mostra os comandos completos).
.PHONY: up down reset test test-back test-front logs

up: ## sobe tudo (build incluso)
	docker compose up --build

down: ## derruba mantendo os dados
	docker compose down

reset: ## volta ao estado original do seed (apaga os dados criados no uso)
	docker compose down -v
	docker compose up --build

test: test-back test-front ## roda as duas suítes

test-back: ## API: unitários + integração no PostgreSQL real (banco de teste próprio)
	docker compose --profile test run --rm --build back-test

test-front: ## front: lógica e componentes
	docker compose --profile test run --rm --build front-test

logs: ## acompanha os logs da API
	docker compose logs -f api
