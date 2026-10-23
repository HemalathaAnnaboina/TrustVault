package com.trustvault;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import jakarta.persistence.EntityManager;
import jakarta.persistence.metamodel.EntityType;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@TestPropertySource(properties = {
    "spring.flyway.enabled=true",
    "spring.jpa.hibernate.ddl-auto=validate",
    "spring.datasource.url=jdbc:h2:mem:schematest;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1"
})
public class FlywaySchemaValidationTest {

    @Autowired
    private EntityManager entityManager;

    @Test
    void whenFlywayMigrationsApply_thenHibernateSchemaValidationSucceeds() {
        assertNotNull(entityManager, "EntityManager should be initialized");
        EntityType<?> documentEntity = entityManager.getMetamodel().getEntities().stream()
                .filter(e -> e.getName().equals("Document"))
                .findFirst()
                .orElse(null);
        assertNotNull(documentEntity, "Document entity should be registered");
        assertTrue(documentEntity.getAttributes().stream().anyMatch(a -> a.getName().equals("sha256Checksum")),
                "sha256Checksum attribute should be present");
    }

    @Test
    void whenMigrationsValidated_thenAllMigrationsPassValidation() {
        org.flywaydb.core.Flyway flyway = org.flywaydb.core.Flyway.configure()
                .dataSource("jdbc:h2:mem:schematest2;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1", "sa", "")
                .locations("classpath:db/migration")
                .load();
        flyway.migrate();
        org.flywaydb.core.api.MigrationInfo[] infos = flyway.info().all();
        assertTrue(infos.length >= 7, "Should have at least 7 migrations applied");
        for (var info : infos) {
            assertTrue(info.getState().isApplied(), "Migration " + info.getVersion() + " should be applied");
        }
    }
}
