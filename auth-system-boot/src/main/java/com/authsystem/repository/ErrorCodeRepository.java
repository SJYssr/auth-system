package com.authsystem.repository;

import com.authsystem.model.entity.ErrorCode;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ErrorCodeRepository extends JpaRepository<ErrorCode, Integer> {

    @Query("SELECT e FROM ErrorCode e WHERE " +
           "(:keyword IS NULL OR e.code LIKE %:keyword% OR e.message LIKE %:keyword%)")
    Page<ErrorCode> findWithFilters(@Param("keyword") String keyword,
                                    Pageable pageable);
}
