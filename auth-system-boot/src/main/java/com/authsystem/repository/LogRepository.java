package com.authsystem.repository;

import com.authsystem.model.entity.Log;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface LogRepository extends JpaRepository<Log, Integer> {

    @Query("SELECT l FROM Log l WHERE " +
           "(:username IS NULL OR l.username LIKE %:username%) AND " +
           "(:action IS NULL OR l.action = :action) AND " +
           "(:module IS NULL OR l.module = :module) AND " +
           "(:status IS NULL OR l.responseStatus = :status) AND " +
           "(:startDate IS NULL OR l.createdAt >= :startDate) AND " +
           "(:endDate IS NULL OR l.createdAt <= :endDate)")
    Page<Log> findWithFilters(@Param("username") String username,
                              @Param("action") String action,
                              @Param("module") String module,
                              @Param("status") String status,
                              @Param("startDate") LocalDateTime startDate,
                              @Param("endDate") LocalDateTime endDate,
                              Pageable pageable);

    Page<Log> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Modifying
    @Transactional
    @Query("DELETE FROM Log l WHERE l.id IN :ids")
    int deleteByIds(@Param("ids") List<Integer> ids);

    @Modifying
    @Transactional
    @Query("DELETE FROM Log l WHERE l.createdAt < :before")
    int deleteOlderThan(@Param("before") LocalDateTime before);

    @Modifying
    @Transactional
    @Query("DELETE FROM Log l")
    int deleteAllLogs();

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM logs WHERE id NOT IN (SELECT id FROM (SELECT id FROM logs ORDER BY created_at DESC LIMIT :limit) t)", nativeQuery = true)
    int deleteOldestExceeding(@Param("limit") int limit);
}
