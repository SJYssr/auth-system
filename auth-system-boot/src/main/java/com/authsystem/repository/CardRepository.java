package com.authsystem.repository;

import com.authsystem.model.entity.Card;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CardRepository extends JpaRepository<Card, Integer> {

    Optional<Card> findByCard(String card);
    boolean existsByCard(String card);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Card c WHERE c.card = :card")
    Optional<Card> findByCardForUpdate(@Param("card") String card);

    @Modifying
    @Query("UPDATE Card c SET c.loginCount = c.loginCount + 1, c.updatedAt = :now WHERE c.id = :id")
    int incrementLoginCount(@Param("id") Integer id, @Param("now") LocalDateTime now);
    long countByAppId(Integer appId);

    long countByAppIdAndStatus(Integer appId, String status);
    long countByAppIdAndIsActivated(Integer appId, Integer isActivated);

    @Query("SELECT c FROM Card c WHERE " +
           "(:appId IS NULL OR c.appId = :appId) AND " +
           "(:userId IS NULL OR (:userId = -1 AND c.userId IS NULL) OR c.userId = :userId) AND " +
           "(:cardType IS NULL OR c.cardType = :cardType) AND " +
           "(:status IS NULL OR c.status = :status) AND " +
           "(:isActivated IS NULL OR c.isActivated = :isActivated) AND " +
           "(:cardContent IS NULL OR c.card LIKE %:cardContent%) AND " +
           "(:cardRemark IS NULL OR c.cardRemark LIKE %:cardRemark%) AND " +
           "(:isExpired IS NULL OR " +
           "  (:isExpired = 1 AND c.expiresAt IS NOT NULL AND c.expiresAt < CURRENT_TIMESTAMP) OR " +
           "  (:isExpired = 0 AND (c.expiresAt IS NULL OR c.expiresAt >= CURRENT_TIMESTAMP)))")
    Page<Card> findWithFilters(@Param("appId") Integer appId,
                               @Param("userId") Integer userId,
                               @Param("cardType") String cardType,
                               @Param("status") String status,
                               @Param("isActivated") Integer isActivated,
                               @Param("cardContent") String cardContent,
                               @Param("cardRemark") String cardRemark,
                               @Param("isExpired") Integer isExpired,
                               Pageable pageable);

    @Query("SELECT COUNT(c) FROM Card c WHERE c.isActivated = 1")
    long countActivated();

    @Query("SELECT COUNT(c) FROM Card c WHERE c.isActivated = 0")
    long countInactive();

    @Query("SELECT COUNT(c) FROM Card c WHERE c.status = 'enabled'")
    long countEnabled();

    @Query("SELECT COUNT(c) FROM Card c WHERE c.expiresAt IS NOT NULL AND c.expiresAt < CURRENT_TIMESTAMP")
    long countExpired();

    @Query("SELECT COUNT(c) FROM Card c WHERE c.token IS NOT NULL AND c.lastLoginTime >= :since")
    long countOnline(@Param("since") LocalDateTime since);

    @Query(value = "SELECT c.card_type, COUNT(c.id), COALESCE(SUM(c.price), 0) FROM cards c WHERE c.app_id = :appId AND c.is_activated = 1 GROUP BY c.card_type", nativeQuery = true)
    List<Object[]> revenueByCardType(@Param("appId") Integer appId);

    Page<Card> findByIsActivatedOrderByActivatedAtDesc(Integer isActivated, Pageable pageable);
}
