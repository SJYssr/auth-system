package com.authsystem.repository;

import com.authsystem.model.entity.App;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AppRepository extends JpaRepository<App, Integer> {

    Optional<App> findBySoftid(String softid);
    boolean existsByAppName(String appName);

    @Query("SELECT a FROM App a WHERE " +
           "(:keyword IS NULL OR a.appName LIKE %:keyword% OR a.description LIKE %:keyword%) AND " +
           "(:status IS NULL OR a.status = :status)")
    Page<App> findWithFilters(@Param("keyword") String keyword,
                              @Param("status") String status,
                              Pageable pageable);

    @Query("SELECT a FROM App a WHERE " +
           "(:keyword IS NULL OR a.appName LIKE %:keyword% OR a.description LIKE %:keyword%) AND " +
           "(:status IS NULL OR a.status = :status) AND " +
           "(:userId IS NULL OR (:userId = -1 AND a.userId IS NULL) OR a.userId = :userId) AND " +
           "(:startDate IS NULL OR FUNCTION('DATE', a.createdAt) >= :startDate) AND " +
           "(:endDate IS NULL OR FUNCTION('DATE', a.createdAt) <= :endDate)")
    Page<App> findWithAdminFilters(@Param("keyword") String keyword,
                                   @Param("status") String status,
                                   @Param("userId") Integer userId,
                                   @Param("startDate") String startDate,
                                   @Param("endDate") String endDate,
                                   Pageable pageable);

    long countByStatus(String status);
}
