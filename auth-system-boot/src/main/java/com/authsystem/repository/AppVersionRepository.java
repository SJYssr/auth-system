package com.authsystem.repository;

import com.authsystem.model.entity.AppVersion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface AppVersionRepository extends JpaRepository<AppVersion, Integer> {

    @Query("SELECT v FROM AppVersion v WHERE " +
           "(:appId IS NULL OR v.appId = :appId) AND " +
           "(:userId IS NULL OR (:userId = -1 AND v.userId IS NULL) OR v.userId = :userId) AND " +
           "(:status IS NULL OR v.status = :status) AND " +
           "(:keyword IS NULL OR v.version LIKE %:keyword% OR v.versionName LIKE %:keyword%)")
    Page<AppVersion> findWithFilters(@Param("appId") Integer appId,
                                     @Param("userId") Integer userId,
                                     @Param("status") String status,
                                     @Param("keyword") String keyword,
                                     Pageable pageable);

    boolean existsByAppIdAndVersion(Integer appId, String version);

    @Query("SELECT COUNT(v) > 0 FROM AppVersion v WHERE v.appId = :appId AND v.version = :version AND v.id != :excludeId")
    boolean existsByAppIdAndVersionExcludingId(@Param("appId") Integer appId,
                                                @Param("version") String version,
                                                @Param("excludeId") Integer excludeId);

    AppVersion findTopByAppIdAndStatusOrderByCreatedAtDesc(Integer appId, String status);
}
