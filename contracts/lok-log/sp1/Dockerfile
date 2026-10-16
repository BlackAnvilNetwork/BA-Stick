# Build the SP1 executor. The game server spawns the resulting binary.
# The image does not prove, pin a verifying key, or talk to a chain.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        clang \
        cmake \
        curl \
        git \
        libssl-dev \
        pkg-config \
        protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

ENV SHELL=/bin/bash
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

RUN curl -L https://sp1up.succinct.xyz | bash \
    && /root/.sp1/bin/sp1up --version 6.9.0
ENV PATH="/root/.sp1/bin:${PATH}"

# protoc needs google/protobuf/empty.proto, which ships in libprotobuf-dev.
RUN apt-get update && apt-get install -y --no-install-recommends libprotobuf-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY engine /src/engine
COPY sp1 /src/sp1

ENV CARGO_BUILD_JOBS=2
ENV SP1_PROVER=cpu
WORKDIR /src/sp1/script
RUN --mount=type=cache,target=/root/.cargo/registry \
    --mount=type=cache,target=/root/.cargo/git \
    --mount=type=cache,target=/tmp/sp1-target \
    cargo prove --version \
    && cargo build --release --target-dir /tmp/sp1-target \
    && cp /tmp/sp1-target/release/lok-sp1-execute /usr/local/bin/lok-sp1-execute

ENTRYPOINT ["/usr/local/bin/lok-sp1-execute"]
