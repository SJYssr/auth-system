package com.authsystem.repository;

import com.authsystem.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {
    Optional<User> findByUsername(String username);
    Optional<User> findByToken(String token);
    boolean existsByUsername(String username);

    @Query("SELECT COUNT(u) FROM User u WHERE u.lastLogin >= :since AND u.status = 'enabled'")
    long countOnlineUsers(@Param("since") LocalDateTime since);
}
