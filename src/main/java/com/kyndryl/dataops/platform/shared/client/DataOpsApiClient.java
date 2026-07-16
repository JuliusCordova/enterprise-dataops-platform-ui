package com.kyndryl.dataops.platform.shared.client;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class DataOpsApiClient {

    private static final Logger log =
        LoggerFactory.getLogger(
            DataOpsApiClient.class
        );

    private final RestClient restClient;
    private final String baseUrl;

    public DataOpsApiClient(
        RestClient.Builder builder,
        @Value("${dataops.api.base-url}")
        String baseUrl
    ) {
        this.baseUrl =
            normalizeBaseUrl(baseUrl);

        this.restClient = builder
            .baseUrl(this.baseUrl)
            .build();

        log.info(
            "DataOpsApiClient initialized. baseUrl={}",
            this.baseUrl
        );
    }

    public Map<String, Object> get(
        String path
    ) {
        log.info(
            "GET backend. path={}",
            path
        );

        try {
            return restClient
                .get()
                .uri(path)
                .accept(
                    MediaType.APPLICATION_JSON
                )
                .retrieve()
                .body(Map.class);

        } catch (
            RestClientResponseException ex
        ) {
            log.error(
                "GET backend failed. path={}, status={}, body={}",
                path,
                ex.getStatusCode(),
                ex.getResponseBodyAsString()
            );

            throw ex;

        } catch (Exception ex) {
            log.error(
                "GET backend failed. path={}, error={}",
                path,
                ex.getMessage(),
                ex
            );

            throw ex;
        }
    }

    public Map<String, Object> post(
        String path,
        Object request
    ) {
        log.info(
            "POST backend. path={}",
            path
        );

        try {
            return restClient
                .post()
                .uri(path)
                .contentType(
                    MediaType.APPLICATION_JSON
                )
                .accept(
                    MediaType.APPLICATION_JSON
                )
                .body(request)
                .retrieve()
                .body(Map.class);

        } catch (
            RestClientResponseException ex
        ) {
            log.error(
                "POST backend failed. path={}, status={}, body={}",
                path,
                ex.getStatusCode(),
                ex.getResponseBodyAsString()
            );

            throw ex;

        } catch (Exception ex) {
            log.error(
                "POST backend failed. path={}, error={}",
                path,
                ex.getMessage(),
                ex
            );

            throw ex;
        }
    }

    public Map<String, Object> put(
        String path,
        Object request
    ) {
        log.info(
            "PUT backend. path={}",
            path
        );

        try {
            return restClient
                .put()
                .uri(path)
                .contentType(
                    MediaType.APPLICATION_JSON
                )
                .accept(
                    MediaType.APPLICATION_JSON
                )
                .body(request)
                .retrieve()
                .body(Map.class);

        } catch (
            RestClientResponseException ex
        ) {
            log.error(
                "PUT backend failed. path={}, status={}, body={}",
                path,
                ex.getStatusCode(),
                ex.getResponseBodyAsString()
            );

            throw ex;

        } catch (Exception ex) {
            log.error(
                "PUT backend failed. path={}, error={}",
                path,
                ex.getMessage(),
                ex
            );

            throw ex;
        }
    }

    private String normalizeBaseUrl(
        String value
    ) {
        if (
            value == null
            || value.isBlank()
        ) {
            throw new IllegalArgumentException(
                "La URL del backend DataOps es obligatoria"
            );
        }

        String normalized =
            value.trim();

        return normalized.endsWith("/")
            ? normalized.substring(
                0,
                normalized.length() - 1
            )
            : normalized;
    }
}
