package com.kyndryl.dataops.platform.integration.silver;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class SilverBackendClient {

    private static final Logger log = LoggerFactory.getLogger(SilverBackendClient.class);

    private final RestClient restClient;
    private final String baseUrl;

    public SilverBackendClient(
        RestClient.Builder builder,
        @Value("${dataops.silver.base-url}") String baseUrl
    ) {
        this.baseUrl = normalizeBaseUrl(baseUrl);
        this.restClient = builder.baseUrl(this.baseUrl).build();
        log.info("SilverBackendClient initialized. baseUrl={}", this.baseUrl);
    }

    public Map<String, Object> get(String path) {
        try {
            return restClient.get()
                .uri(path)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(Map.class);
        } catch (RestClientResponseException ex) {
            log.error("GET Silver failed. path={}, status={}, body={}", path, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw ex;
        }
    }

    public Map<String, Object> post(String path, Object request) {
        try {
            return restClient.post()
                .uri(path)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(Map.class);
        } catch (RestClientResponseException ex) {
            log.error("POST Silver failed. path={}, status={}, body={}", path, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw ex;
        }
    }

    public Map<String, Object> put(String path, Object request) {
        try {
            return restClient.put()
                .uri(path)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(Map.class);
        } catch (RestClientResponseException ex) {
            log.error("PUT Silver failed. path={}, status={}, body={}", path, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw ex;
        }
    }

    private String normalizeBaseUrl(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("La URL del backend Silver es obligatoria");
        }
        String normalized = value.trim();
        return normalized.endsWith("/")
            ? normalized.substring(0, normalized.length() - 1)
            : normalized;
    }
}
