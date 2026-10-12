<a id="readme-top"></a>

<div align="center">

<h1>containerized-microservices</h1>

<p>
A containerized microservice stack behind a single Nginx entry point: path-based
routing and load balancing across replicated Node.js services, a React frontend
served as a static build, and PostgreSQL on a Docker volume.
</p>

<a href="#architecture">Architecture</a>
·
<a href="#getting-started">Getting Started</a>
·
<a href="#what-i-learned">What I Learned</a>

</div>

<details>
<summary>Table of Contents</summary>

- [About The Project](#about-the-project)
- [Built With](#built-with)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [Security Notes](#security-notes)
- [What I Learned](#what-i-learned)
- [Roadmap](#roadmap)
- [Contact](#contact)

</details>

---

## About The Project

This project builds a small microservice infrastructure with Docker and Docker
Compose, where every component runs in its own container and the whole stack starts
with a single command.

The goal was an architecture where only one container is reachable from outside, the
services find and call each other over a private network, and the stack can be scaled,
torn down and rebuilt entirely from code.

What the stack does end to end:

- Nginx is the only container with a published port. It routes by path and load
  balances across the replicas behind each service
- A `storage` service calls the `auth` service over the internal network on every
  request before it touches the database, which is the microservice-to-microservice
  hop the design is built around
- Both services run with two replicas, and Docker's embedded DNS resolves the service
  name to a different container on each request
- A React frontend is compiled by Vite in a build stage and served as static files by
  Nginx, so no development server is ever exposed
- PostgreSQL is seeded from an init script and keeps its data in a named Docker volume
  across restarts
- All configuration and credentials arrive through environment variables, so the same
  images run against any database

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Built With

* [![Docker][docker-shield]][docker-url]
* [![Docker Compose][compose-shield]][compose-url]
* [![Nginx][nginx-shield]][nginx-url]
* [![Node.js][node-shield]][node-url]
* [![Express][express-shield]][express-url]
* [![React][react-shield]][react-url]
* [![Vite][vite-shield]][vite-url]
* [![PostgreSQL][pg-shield]][pg-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Architecture

```
                              Browser
                                 │
                            host port 8080
                                 │
                        ┌────────────────┐
                        │     NGINX      │  the only published port
                        │  path routing  │
                        └────────────────┘
                         /       │       \
                 /api/auth/  /api/storage/  /
                     │           │           │
┌──────────────── app-network (private bridge) ────────────────────────────┐
│                     │           │           │                            │
│              ┌──────────┐  ┌───────────┐  ┌──────────┐                   │
│              │  auth_1  │  │ storage_1 │  │ frontend │ static build      │
│              │  auth_2  │  │ storage_2 │  └──────────┘                   │
│              └──────────┘  └───────────┘                                 │
│                     ▲           │                                        │
│                     └───────────┘  storage calls auth on every request   │
│                     │           │                                        │
│                  ┌────────────────┐                                      │
│                  │   PostgreSQL   │  named volume: postgres_data         │
│                  └────────────────┘                                      │
└──────────────────────────────────────────────────────────────────────────┘
  No service except Nginx is reachable from the host
```

**Design decisions**

- **One public entry point.** Only Nginx maps a port to the host. Every other service
  uses `expose`, which opens the port to the Docker network and not to the host, so the
  services and the database cannot be reached from outside even by accident.
- **Service discovery by name, not by address.** `storage` calls `http://auth:3000`.
  Docker's embedded DNS resolves that name to the auth replicas and hands back a
  different one each time, so scaling needs no configuration change anywhere.
- **One shared PostgreSQL.** A strict microservice design gives each service its own
  database for isolation and independent schema migrations. Here a second instance
  would cost memory and a second set of credentials while the auth service owns no
  data at all, so the trade-off is deliberate. Because `DB_HOST` is an environment
  variable, splitting it later means adding one service and changing one value.
- **The React dev server is never deployed.** A multi-stage build compiles the app with
  Vite and copies only `dist/` into an Nginx image. The runtime image carries no Node
  runtime, no source and no dev dependencies.
- **Services run as a non-root user.** The Node images drop to the built-in `node` user
  after dependencies are installed, so a compromised process does not own the
  filesystem it runs on.
- **Credentials come from the environment.** Nothing is baked into an image or a
  compose file; `.env` holds the values and is git-ignored.
- **Structured logs.** Nginx and both services emit one JSON object per request with
  method, path, source IP, instance and status, so the output is machine-readable
  instead of a prose line to grep.
- **Health endpoints have no dependencies.** `/health` reports only that the process is
  alive. A failing downstream service should not make a healthy one look unhealthy.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Project Structure

```
containerized-microservices/
├── auth-service/
│   ├── Dockerfile               # Node 22 alpine, non-root runtime
│   ├── index.js                 # Express app, /auth and /health
│   └── package.json
├── storage-service/
│   ├── Dockerfile
│   ├── index.js                 # Calls auth, then reads from PostgreSQL
│   └── package.json
├── frontend/
│   ├── Dockerfile               # Vite build stage, Nginx runtime stage
│   ├── nginx.conf               # Static file serving with SPA fallback
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       └── main.jsx
├── nginx/
│   └── nginx.conf               # Upstreams, path routing, JSON access log
├── postgres/
│   └── init.sql                 # Schema and seed data, runs on first start
├── docker-compose.yml           # Services, private network, named volume
├── .env.example                 # Template for the real .env (git-ignored)
└── .gitignore
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

### Prerequisites

- Docker Engine

```sh
  docker --version
```

- Docker Compose

```sh
  docker-compose --version
```

### Installation

1. Clone the repository

```sh
   git clone https://github.com/ladooli/containerized-microservices.git
   cd containerized-microservices
```

2. Create your own `.env` from the template and set a real password

```sh
   cp .env.example .env
```

3. Start the stack with two replicas of each service

```sh
   docker-compose up --build --scale auth=2 --scale storage=2 -d
```

4. Confirm that all seven containers are running

```sh
   docker-compose ps
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

Open `http://localhost:8080` in a browser and use the button to fetch through the full
chain, or call the services from the terminal.

```sh
curl http://localhost:8080/api/auth/health
```

```json
{ "status": "ok", "service": "auth", "instance": "9e8dceeae3a0" }
```

```sh
curl http://localhost:8080/api/storage/storage
```

```json
{
  "authorized": true,
  "data": [{ "id": 1, "name": "Alpha item", "description": "..." }],
  "service": "storage",
  "instance": "71a926020d47",
  "auth_instance": "9e8dceeae3a0"
}
```

The two instance fields are the interesting part: they name the container that answered
and the container that authorized it. Repeat the request and both rotate, which is the
load balancer picking a different replica.

```sh
for i in 1 2 3 4; do curl -s http://localhost:8080/api/storage/storage | grep -o '"instance":"[^"]*"'; done
```

Follow the structured logs, or open a shell in any container:

```sh
docker-compose logs -f storage
```

```sh
docker exec -it $(docker-compose ps -q postgres) psql -U appuser -d appdb -c "SELECT * FROM items;"
```

Stop the stack. The named volume survives `down`, so the database keeps its data; add
`-v` to remove it and start from a clean schema.

```sh
docker-compose down
```

```sh
docker-compose down -v
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Security Notes

- **No credentials in the repository.** Only `.env.example` with a placeholder is
  committed; the real `.env` is git-ignored. Nothing is hardcoded in the compose file,
  the Dockerfiles or the source.
- **Only one port is published.** Every other service uses `expose`, so the services
  and the database are reachable on the Docker network and nowhere else. The database
  never leaves the private bridge.
- **Containers run as a non-root user.** Both Node services switch to the unprivileged
  `node` user before the process starts.
- **Images carry no build tooling.** The frontend runtime image contains static files
  and Nginx only; the Node images install production dependencies with `--omit=dev` and
  clear the npm cache in the same layer.
- **Instance identifiers are exposed in responses.** `instance` returns the container
  ID, which is useful for demonstrating load balancing but is internal detail that a
  production API would not return.
- **The auth service is a stub.** It verifies that its database is reachable and
  returns `authorized: true`. The routing, the service-to-service call and the failure
  handling around it are real; the credential check itself is not implemented.
- **No TLS.** The stack serves plain HTTP on a local port. A public deployment would
  terminate HTTPS at Nginx with a real certificate and redirect port 80.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## What I Learned

- **`expose` and `ports` are not the same thing.** `ports` opens a container to the
  host; `expose` only documents and opens it to the Docker network. Getting that
  distinction right is what actually makes the services private, not the fact that they
  sit behind a proxy.
- **Scaling works because of DNS, not configuration.** Compose gives every replica the
  same service name, and Docker's embedded resolver rotates between them. Nothing in
  the Nginx config or the application code knows how many replicas exist.
- **A container's first dependency is rarely ready.** PostgreSQL accepts connections
  seconds after the container starts, so `depends_on` is not enough. The services retry
  on an interval instead of crashing on the first failure.
- **A multi-stage build is what keeps a React image small.** Building and serving in one
  stage ships the entire toolchain to production; copying `dist/` into an Nginx image
  leaves the build behind.
- **A health check should not call anything.** An early version of the deep check made
  one failing service drag healthy ones down with it, so the probe endpoint deliberately
  tests nothing but the process.
- **Compose file versions are not forward compatible.** A `version: '3.8'` file is
  rejected by the Compose binary shipped with older distributions, which is a reminder
  that the runtime version is part of the contract.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Roadmap

- [x] Nginx as the single entry point with path-based routing and load balancing
- [x] Two microservices communicating over a private Docker network
- [x] Two replicas per service, discovered by name
- [x] PostgreSQL with an init script and a named volume
- [x] React frontend as a static multi-stage build
- [x] Credentials and configuration through environment variables
- [x] Structured JSON request logs in Nginx and both services
- [x] Non-root container users
- [x] Custom DNS resolvers for all containers
- [ ] Real authentication in the auth service with hashed credentials and tokens
- [ ] A separate database per service
- [ ] Compose health checks with `depends_on` conditions
- [ ] HTTPS termination at Nginx with a certificate
- [ ] An independent Redis-backed service
- [ ] A scheduled health-report container writing a timestamped summary
- [ ] CI pipeline building the images and running a smoke test on pull requests

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

Olivér — [LinkedIn](https://www.linkedin.com/in/oliv%C3%A9r-ladoniczki-28306b307/)

Project link: [https://github.com/ladooli/containerized-microservices](https://github.com/ladooli/containerized-microservices)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

[docker-shield]: https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white
[docker-url]: https://www.docker.com/
[compose-shield]: https://img.shields.io/badge/Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white
[compose-url]: https://docs.docker.com/compose/
[nginx-shield]: https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white
[nginx-url]: https://nginx.org/
[node-shield]: https://img.shields.io/badge/Node.js-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white
[node-url]: https://nodejs.org/
[express-shield]: https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white
[express-url]: https://expressjs.com/
[react-shield]: https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black
[react-url]: https://react.dev/
[vite-shield]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[vite-url]: https://vitejs.dev/
[pg-shield]: https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white
[pg-url]: https://www.postgresql.org/
