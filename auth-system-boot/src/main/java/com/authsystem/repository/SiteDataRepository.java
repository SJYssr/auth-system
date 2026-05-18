package com.authsystem.repository;

import com.authsystem.model.entity.SiteData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SiteDataRepository extends JpaRepository<SiteData, Integer> {
    Optional<SiteData> findFirstByOrderByIdAsc();
}
