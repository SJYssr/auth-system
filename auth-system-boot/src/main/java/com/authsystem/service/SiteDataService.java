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
        site.setSiteTitle((String) data.get("site_title"));
        site.setKeywords((String) data.get("keywords"));
        site.setDescription((String) data.get("description"));
        site.setLogoUrl((String) data.get("logo_url"));
        site.setFaviconUrl((String) data.get("favicon_url"));
        site.setIcpNumber((String) data.get("icp_number"));
        site.setContactEmail((String) data.get("contact_email"));
        site.setContactPhone((String) data.get("contact_phone"));
        site.setContactAddress((String) data.get("contact_address"));
        site.setCopyright((String) data.get("copyright"));
        site.setStatus(getValidStatus((String) data.get("status")));
        site.setUpdatedAt(LocalDateTime.now());
        return siteDataRepository.save(site);
    }

    private String getValidStatus(String status) {
        return (status != null && (status.equals("enabled") || status.equals("disabled"))) ? status : "enabled";
    }
}
