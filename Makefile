.PHONY: network
network: ## create the shared docker network all repos here join (idempotent)
	@docker network inspect shohoz >/dev/null 2>&1 || docker network create shohoz

.PHONY: add-client
add-client: ## Create or update an OAuth2 client (CLIENT_ID=... REDIRECT_URI=... USER_TYPE=staff|consumer|client [SECRET=...] [SCOPE=...] [AUDIENCE=...])
	@./scripts/add-client.sh

.PHONY: lint
lint: ## helm lint against every helmvars file
	@for f in helmvars/*.yaml; do helm lint chart -f $$f || exit 1; done

.PHONY: template
template: ## helm template against every helmvars file, output discarded (render-only check)
	@for f in helmvars/*.yaml; do helm template idp chart -f $$f > /dev/null || exit 1; done
