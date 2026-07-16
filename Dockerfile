FROM eclipse-temurin:21-jre

WORKDIR /app

COPY target/enterprise-dataops-platform-ui-0.0.1-SNAPSHOT.jar app.jar

ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
