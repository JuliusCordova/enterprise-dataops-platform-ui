package com.kyndryl.dataops.platform.integration.silver;

import java.util.Map;

import org.springframework.stereotype.Component;

@Component
public class SilverArtifactClient {

    private final SilverBackendClient client;

    public SilverArtifactClient(SilverBackendClient client) {
        this.client = client;
    }

    public Map<String, Object> listArtifacts(String specId) {
        return client.get("/silver-refinement/specs/" + validate(specId) + "/artifacts");
    }

    public Map<String, Object> generateArtifacts(String specId, Object request) {
        return client.post(
            "/silver-refinement/specs/" + validate(specId) + "/artifacts/generate",
            request
        );
    }

    public Map<String, Object> generateDdl(String specId, Object request) {
        return client.post(
            "/silver-refinement/specs/" + validate(specId) + "/artifacts/ddl",
            request
        );
    }

    private String validate(String value) {
        if (value == null || !value.trim().matches("[A-Za-z0-9_\\-]+")) {
            throw new IllegalArgumentException("specId inválido");
        }
        return value.trim();
    }
}
