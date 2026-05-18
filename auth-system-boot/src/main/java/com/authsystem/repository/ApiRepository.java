package com.authsystem.repository;

import com.authsystem.model.entity.Api;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ApiRepository extends JpaRepository<Api, Integer> {

    @Query("SELECT a FROM Api a WHERE " +
           "(:keyword IS NULL OR a.apiName LIKE %:keyword% OR a.apiPath LIKE %:keyword%)")
    Page<Api> findWithFilters(@Param("keyword") String keyword,
                              Pageable pageable);
}
