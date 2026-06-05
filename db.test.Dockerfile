# Postgres 16 with pgTAP pre-installed for database unit tests
FROM postgres:16-alpine AS builder
RUN apk add --no-cache build-base git postgresql-dev
RUN git clone --depth 1 --branch v1.3.2 https://github.com/theory/pgtap.git /tmp/pgtap
WORKDIR /tmp/pgtap
RUN make && make install

FROM postgres:16-alpine
COPY --from=builder /usr/local/lib/postgresql/pgtap*.so /usr/local/lib/postgresql/
COPY --from=builder /usr/local/share/postgresql/extension/pgtap* /usr/local/share/postgresql/extension/
HEALTHCHECK --interval=5s --timeout=5s --retries=10 \
  CMD pg_isready -U postgres -d postgres
