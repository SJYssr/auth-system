package com.authsystem.service;

import com.authsystem.model.entity.SiteData;
import com.authsystem.repository.SiteDataRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Service
public class SiteDataService {

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

        site.setSiteName((String) data.get("site_name"));
        site.setLogoUrl((String) data.get("logo_url"));
        site.setFaviconUrl((String) data.get("favicon_url"));
        site.setContactEmail((String) data.get("contact_email"));
        site.setContactPhone((String) data.get("contact_phone"));
        site.setUpdatedAt(LocalDateTime.now());
        return siteDataRepository.save(site);
    }
}
