#!/bin/bash
set -e

SERVICES=("torii" "lore-machine" "katana")

help() {
	echo -e "Usage: $(basename $0) <command>\ncommand:\n  -start [service1 service2 ...]: starts all services if no service(s) name(s) is/are passed\n  -stop [service1 service2 ...]: stops all services if no service(s) name(s) is/are passed\n  -restart: [service1 service2 ...]: restarts all services if no service(s) name(s) is/are passed\n  -prune: clear the system of all images, volumes, networks, containers, etc. (!this will remove ALL docker data)\n  -clean_cache: cleans the client's cached files (node_modules and bun cache)\n  -build_client: builds all files necessary for the client, you still need to run it yourself\n  -build_contracts: builds all contracts"
	exit 22
}

start_services() {
	local build_args=""
	if [ $1 = true ]; then
		shift 1
		for service in "$@"; do
			if [[ ! $(echo ${SERVICES[@]} | fgrep -w ${service}) ]]; then
				help "restart"
			fi
			build_args+="--build-arg RESTART_$(echo ${service} | tr [a-z]- [A-Z]_ )=true "
		done
	fi
	echo "👷 Building service(s)"
	docker compose build ${build_args} $@
	echo "▶️ Starting service(s)"
	docker compose up -d --no-deps $@
}

stop_services() {
	echo "🛑 Stopping service(s)"
	docker-compose down $@
}

prune_services() {
	echo "🧹 pruning docker files"
	docker system prune --all
}

clean_cache() {
	echo "🧹 cleaning client cache"
	rm -rf node_modules || rm -rf ./client/node_modules || rm -rf ~/.bun/install/cache
}

build_contracts() {
	echo "📑 Building contrats"
	cd contracts && sozo build
}

build_client() {
	echo "👷 Building client"
	clean_cache
	bun install
	bun run build-packages
	bun install
}

COMMAND=$1
shift 1

SERVICES=$@

if [ $COMMAND = "start" ]; then
	build_contracts
	start_services $SERVICES
elif [ $COMMAND = "stop" ]; then
	stop_services $SERVICES
elif [ $COMMAND = "restart" ]; then
	stop_services $SERVICES
	start_services true $SERVICES
elif [ $COMMAND = "prune_docker" ]; then
	prune_services
elif [ $COMMAND = "clean_cache" ]; then
	clean_cache
elif [ $COMMAND = "build_client" ]; then
	build_client
elif [ $COMMAND = "build_contracts" ]; then
	build_contracts
else
	help ${COMMAND}
fi
