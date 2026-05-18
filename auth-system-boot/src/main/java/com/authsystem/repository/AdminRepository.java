package com.authsystem.repository;

import com.authsystem.model.entity.Admin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface AdminRepository extends JpaRepository<Admin, Integer> {
    Optional<Admin> findByUsername(String username);
    Optional<Admin> findByToken(String token);
    boolean existsByUsername(String username);

    @Query("SELECT COUNT(a) FROM Admin a WHERE a.lastLogin >= :since AND a.status = 'enabled'")
    long countOnlineUsers(@Param("since") LocalDateTime since);
}
