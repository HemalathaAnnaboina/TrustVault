# Build Spring Boot application using Java 23
FROM maven:3.9-eclipse-temurin-23 AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn -B -DskipTests package

# Run application using Java 23
FROM eclipse-temurin:23-jre

WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

ENV PORT=10000

EXPOSE 10000

ENTRYPOINT ["sh", "-c", "exec java -XX:MaxRAMPercentage=65 -Dserver.port=${PORT:-10000} -jar app.jar"]