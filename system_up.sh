#!/bin/bash
set -e

help() {
	echo -e "Usage: $(basename $0) <command>\ncommand:\n  -start [service1 service2 ...]: starts all services if no service(s) name(s) is/are passed\n  -stop [service1 service2 ...]: stops all services if no service(s) name(s) is/are passed\n  -restart_service <service>: rebuilds and restarts a particular service\n  -restart: restarts all services\n  -prune: clear the system of all images, volumes, networks, containers, etc. (!this will remove ALL docker data)\n  -clean_cache: cleans the client's cached files (node_modules and bun cache)\n  -build_client: builds all files necessary for the client, you still need to run it yourself"
	exit 22
}

start_services() {
	# Build contracts
	cd contracts && sozo build
	cd ..
	docker compose up -d --no-deps --build $@
}

stop_services() {
	if [ ! -n $1 ]; then
		help "stop"
	fi
	docker-compose down $@
}

restart_service() {
	if [ ! -n $1 ]; then
		help "restart_service"
	fi
	service=$1
	RESTART_SERVICE="RESTART_$(echo ${service} | tr [a-z] [A-Z])"
	docker compose build --build-arg ${RESTART_SERVICE}=true ${service}
	docker compose up -d --no-deps ${service}
}

prune_services() {
	docker system prune --all
}

clean_cache() {
	rm -rf node_modules || rm -rf ./client/node_modules || rm -rf ~/.bun/install/cache
}

build_client() {
	clean_cache
	bun install
	bun run build-packages
	bun install
}

COMMAND=$1
shift 1

if [ $COMMAND = "start" ]; then
	start_services $@
elif [ $COMMAND = "stop" ]; then
	stop_services $@
elif [ $COMMAND = "restart" ]; then
	stop_services
	start_services
elif [ $COMMAND = "prune_docker" ]; then
	prune_services
elif [ $COMMAND = "clean_cache" ]; then
	clean_cache
elif [ $COMMAND = "build_client" ]; then
	build_client
elif [ $COMMAND = "restart_service" ]; then
	restart_service $1
else
	help ${COMMAND}
fi
