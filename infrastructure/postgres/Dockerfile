FROM postgres:16-alpine AS prepared

RUN apk upgrade --no-cache \
    && apk add --no-cache su-exec \
    && sed -i 's/exec gosu postgres/exec su-exec postgres/' /usr/local/bin/docker-entrypoint.sh \
    && rm -f /usr/local/bin/gosu

# Reempaqueta solo el filesystem final. Así gosu no permanece en una capa
# histórica que los escáneres puedan seguir indexando.
FROM scratch

COPY --from=prepared / /

ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    LANG=en_US.utf8 \
    PG_MAJOR=16 \
    PG_VERSION=16.14 \
    PGDATA=/var/lib/postgresql/data

VOLUME ["/var/lib/postgresql/data"]
STOPSIGNAL SIGINT
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]
