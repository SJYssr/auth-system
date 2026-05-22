package com.authsystem.service;

import com.authsystem.model.entity.SiteData;
import com.authsystem.repository.SiteDataRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Service
public class SiteDataService {

    private static boolean isValidUrl(String url) {
        if (url == null || url.isEmpty()) return true;
        String lower = url.toLowerCase();
        return lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("/");
    }

    @Autowired
    private SiteDataRepository siteDataRepository;

    public SiteData getSiteData() {
        return siteDataRepository.findFirstByOrderByIdAsc().orElse(null);
    }

    public SiteData updateSiteData(Map<String, Object> data) {
        SiteData site = siteDataRepository.findFirstByOrderByIdAsc()
                .orElseGet(() -> {
                    SiteData s = new SiteData();
                    s.setCreatedAt(LocalDateTime.now());
                    return s;
                });

        String logoUrl = (String) data.get("logo_url");
        String faviconUrl = (String) data.get("favicon_url");
        if (!isValidUrl(logoUrl) || !isValidUrl(faviconUrl))
            throw new IllegalArgumentException("图片地址仅支持 http/https 或相对路径");

        site.setSiteName((String) data.get("site_name"));
        site.setDescription((String) data.get("description"));
        site.setCopyright((String) data.get("copyright"));
        site.setCopyrightSince((String) data.get("copyright_since"));
        site.setIcpNumber((String) data.get("icp_number"));
        site.setLogoUrl(logoUrl);
        site.setFaviconUrl(faviconUrl);
        site.setContactEmail((String) data.get("contact_email"));
        site.setContactPhone((String) data.get("contact_phone"));
        site.setUpdatedAt(LocalDateTime.now());
        return siteDataRepository.save(site);
    }
}
