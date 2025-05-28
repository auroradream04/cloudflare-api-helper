import dotenv from "dotenv"
import express from "express";
import { createDnsRecord, createZone, fetchAllDnsRecords, fetchAllZones, updateDnsRecord, updateSslTlsSettings } from "./util";
import fs from "fs";
import path from "path";

// Load environment variables as early as possible
dotenv.config();

const port = process.env.PORT || 6100;
const app = express();

app.use(express.json());

interface CloudflareZone {
    id: string;
    name: string;
}

interface CloudflareDnsRecord {
    id: string;
    name: string;
    type: string;
}

interface CloudflareResponse {
    result: CloudflareZone[] | CloudflareDnsRecord[];
}

app.get("/", (req, res) => {
    res.status(200).json({
        message: "Welcome to Cloudflare API Helper by @auroradream04 (https://github.com/auroradream04/cloudflare-api-helper)"
    });
});

app.post("/api/v1/cloudflare/getAllZones", async (req, res) => {
    const body = req.body;
    const authKey = body["X-Auth-Key"];
    const authEmail = body["X-Auth-Email"];
    const page = parseInt(body.page || "1");

    // Check auth key and email
    if (!authKey || !authEmail) {
        res.status(401).json({ message: "Unauthorized" });
    }

    // Fetch all zones
    const data = await fetchAllZones(authKey, authEmail, page);

    res.status(200).json(data);
});

app.post("/api/v1/cloudflare/updateAllDnsRecord", async (req, res) => {
    const body = req.body;
    const authKey = body["X-Auth-Key"];
    const authEmail = body["X-Auth-Email"];
    const domains = body.domains;
    const domainListEndpoint = body.domain_list_endpoint;
    const newIp = body.new_ip;

    // Check auth key and email
    if (!authKey || !authEmail) {
        res.status(401).json({ message: "Unauthorized" });
    }

    // Bad requests
    if (!domainListEndpoint && !domains || !newIp) {
        res.status(400).json({ message: "Bad Request" });
    }

    // Fetch domain list
    let domainList: string[];

    if (domains) {
        domainList = domains;
    } else {
        const domainListResponse = await fetch(domainListEndpoint);
        domainList = (await domainListResponse.text()).split("\n");
    }

    // Fetch all zones
    const allZones = await fetchAllZones(authKey, authEmail, 1);

    const successfulDomains: string[] = [];

    // Loop through each zone
    for (const zone of allZones.result) {
        const zoneId = zone.id;
        const zoneName = zone.name;

        // Check if the zone name is in the domain list
        if (domainList.includes(zoneName)) {
            // Fetch all DNS records
            const dnsRecords = await fetchAllDnsRecords(authKey, authEmail, zoneId);

            // Loop through each DNS record
            for (const record of dnsRecords.result) {
                const recordId = record.id;
                const recordType = record.type;

                // Update the DNS record with the new IP
                if (recordType === "A") {
                    await updateDnsRecord(authKey, authEmail, zoneId, recordId, record, newIp);
                }
            }

            console.log(`Updated ${zoneName} with ${newIp}`);
            successfulDomains.push(zoneName);
        } 
    }

    const failedDomains: string[] = domainList.filter(domain => !successfulDomains.includes(domain));

    console.log("Finished!");
    res.status(200).json({ successful_domains: successfulDomains, failed_domains: failedDomains });
});

app.post("/api/v1/cloudflare/createZoneWithDnsRecord", async (req, res) => {
    const body = req.body;
    const authKey = body["X-Auth-Key"];
    const authEmail = body["X-Auth-Email"];
    const domains = Array.isArray(body.domain_name) ? body.domain_name : [body.domain_name];
    const dnsRecordNames = body.dns_record_names;
    const accountId = body.account_id;
    const type = body.type;
    const startingIp = body.ip; // This will be the first IP address

    // Check auth key and email
    if (!authKey || !authEmail) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    // Bad requests
    if (!domains.length || !dnsRecordNames || !accountId || !type || !startingIp) {
        return res.status(400).json({ message: "Bad Request" });
    }

    const results = [];
    const errors = [];

    // Split IP into octets for incrementing
    const ipParts = startingIp.split('.');
    let currentIpLastOctet = parseInt(ipParts[3]);

    // Process each domain
    for (const domainName of domains) {
        // Skip undefined or empty domains
        if (!domainName || typeof domainName !== 'string') {
            errors.push({
                domain: domainName || 'undefined',
                error: `Invalid domain name: ${domainName}`
            });
            continue;
        }

        try {
            // Construct current IP
            const currentIp = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${currentIpLastOctet}`;

            // Create a new zone
            const createZoneResponse = await createZone(authKey, authEmail, domainName, accountId, type);
            
            // Create DNS records for this zone
            const dnsRecordIds = [];
            for (const dnsRecordName of dnsRecordNames) {
                const name = dnsRecordName === "@" ? domainName : `${dnsRecordName}.${domainName}`;
                const createDnsRecordResponse = await createDnsRecord(
                    authKey, 
                    authEmail, 
                    createZoneResponse.result.id, 
                    name, 
                    currentIp
                );
                dnsRecordIds.push(createDnsRecordResponse.result.name);
            }

            results.push({
                domain: domainName,
                ip: currentIp,
                status: "success",
                dns_record_ids: dnsRecordIds
            });

            // Increment IP for next domain
            currentIpLastOctet++;
        } catch (error) {
            errors.push({
                domain: domainName,
                error: error instanceof Error ? error.message : "Unknown error occurred"
            });
        }
    }

    res.status(200).json({
        message: "Operation completed",
        results,
        errors
    });
});

app.post("/api/v1/cloudflare/upsertZoneWithDnsRecord", async (req, res) => {
    const body = req.body;
    const authKey = body["X-Auth-Key"];
    const authEmail = body["X-Auth-Email"];
    let domains = Array.isArray(body.domain_name) ? body.domain_name : [body.domain_name];
    const dnsRecordNames = body.dns_record_names;
    const accountId = body.account_id;
    const type = body.type;
    const startingIp = body.ip;
    const mode = body.mode || "increment"; // Default to increment if not specified

    // Debug: Log the request body structure
    console.log("Request body keys:", Object.keys(body));
    console.log("domain_name value:", body.domain_name);
    console.log("mode:", mode);

    // Check auth key and email
    if (!authKey || !authEmail) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    // Load domain-to-IP mappings for file mode
    let domainIpMap: Record<string, string> = {};
    if (mode === "file") {
        try {
            const domainsJsonPath = path.join(process.cwd(), "domains.json");
            const domainsData = fs.readFileSync(domainsJsonPath, "utf-8");
            domainIpMap = JSON.parse(domainsData);
            console.log(`Loaded ${Object.keys(domainIpMap).length} domain-to-IP mappings from domains.json`);
            
            // If no domains specified in request, use all domains from JSON file
            if (!body.domain_name || domains.includes(undefined) || domains.length === 0) {
                domains = Object.keys(domainIpMap);
                console.log(`No domains specified in request, using all ${domains.length} domains from domains.json`);
            } else {
                console.log(`Using specified domains:`, domains);
            }
            
            console.log(`Available domains in JSON:`, Object.keys(domainIpMap).slice(0, 10) + '...');
        } catch (error) {
            return res.status(500).json({ 
                message: "Failed to load domains.json file", 
                error: error instanceof Error ? error.message : "Unknown error" 
            });
        }
    } else {
        // For non-file modes, domain_name is required
        if (!body.domain_name || domains.includes(undefined) || domains.length === 0) {
            return res.status(400).json({ 
                message: "Bad Request: domain_name is required for increment/decrement/static modes",
                received_domain_name: body.domain_name,
                processed_domains: domains
            });
        }
    }

    console.log("domains after processing:", domains.slice(0, 5) + '...');

    // Bad requests - basic required fields
    if (!dnsRecordNames || !accountId || !type) {
        return res.status(400).json({ message: "Bad Request: dns_record_names, account_id, and type are required" });
    }

    // For non-file modes, we still need startingIp
    if (mode !== "file" && !startingIp) {
        return res.status(400).json({ message: "Bad Request: ip is required for increment/decrement/static modes" });
    }

    const results = [];
    const errors = [];

    // Split IP into octets for incrementing (only for non-file modes)
    let ipParts: string[] = [];
    let currentIpLastOctet = 0;
    if (mode !== "file" && startingIp) {
        ipParts = startingIp.split('.');
        currentIpLastOctet = parseInt(ipParts[3]);
    }

    // Fetch ALL existing zones (handling pagination)
    const zoneMap = new Map<string, CloudflareZone>();
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
        const existingZones = await fetchAllZones(authKey, authEmail, page);
        
        // Check if we have valid results
        if (!existingZones.result || !Array.isArray(existingZones.result)) {
            hasMorePages = false;
            break;
        }
        
        // Add zones to our map
        (existingZones.result as CloudflareZone[]).forEach((zone: CloudflareZone) => {
            zoneMap.set(zone.name, zone);
        });
        
        // Check if we need to fetch more pages
        if (existingZones.result.length === 0 || existingZones.result.length < 50) {
            // Assuming 50 is the page size (adjust if needed)
            hasMorePages = false;
        } else {
            page++;
        }
    }

    console.log(`Found ${zoneMap.size} zones in Cloudflare account`);

    // Process each domain
    for (const domainName of domains) {
        // Skip undefined or empty domains
        if (!domainName || typeof domainName !== 'string') {
            errors.push({
                domain: domainName || 'undefined',
                error: `Invalid domain name: ${domainName}`
            });
            continue;
        }

        console.log(`\n=== Processing domain: ${domainName} ===`);

        try {
            // Determine current IP based on mode
            let currentIp: string;
            
            if (mode === "file") {
                currentIp = domainIpMap[domainName];
                if (!currentIp) {
                    console.log(`❌ Domain "${domainName}" not found in domains.json file`);
                    console.log(`Available domains that start with "${domainName.charAt(0)}":`, 
                        Object.keys(domainIpMap).filter(d => d.startsWith(domainName.charAt(0))).slice(0, 5));
                    errors.push({
                        domain: domainName,
                        error: `Domain not found in domains.json file`
                    });
                    continue;
                }
                console.log(`✅ Found domain "${domainName}" with IP: ${currentIp}`);
            } else {
                // Construct current IP for increment/decrement/static modes
                currentIp = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${currentIpLastOctet}`;
                console.log(`📍 Using IP: ${currentIp} for domain: ${domainName}`);
            }

            let zoneId;
            let action = "created";

            // Check if zone exists
            const existingZone = zoneMap.get(domainName);
            if (existingZone) {
                // Use existing zone
                zoneId = existingZone.id;
                action = "updated";
                console.log(`🔄 Using existing zone for ${domainName}, zone ID: ${zoneId}`);
            } else {
                // Create new zone
                console.log(`🆕 Creating new zone for ${domainName}...`);
                console.log(`Zone creation parameters:`, {
                    domainName,
                    accountId,
                    type
                });
                
                const createZoneResponse = await createZone(authKey, authEmail, domainName, accountId, type);
                console.log(`📋 Create zone response for ${domainName}:`, JSON.stringify(createZoneResponse, null, 2));
                
                if (!createZoneResponse || !createZoneResponse.result) {
                    console.log(`❌ Create zone failed for ${domainName} - no result in response`);
                    throw new Error(`Failed to create zone: ${createZoneResponse?.errors?.[0]?.message || 'Unknown error'}`);
                }
                
                if (!createZoneResponse.result.id) {
                    console.log(`❌ Create zone failed for ${domainName} - no ID in result`);
                    throw new Error(`Zone creation returned no ID: ${JSON.stringify(createZoneResponse.result)}`);
                }
                
                zoneId = createZoneResponse.result.id;
                console.log(`✅ Successfully created zone for ${domainName}, zone ID: ${zoneId}`);
            }

            // Fetch existing DNS records
            console.log(`🔍 Fetching existing DNS records for zone ${zoneId}...`);
            const existingRecords = await fetchAllDnsRecords(authKey, authEmail, zoneId);
            console.log(`📋 DNS records response for ${domainName}:`, JSON.stringify(existingRecords, null, 2));
            
            if (!existingRecords || !existingRecords.result) {
                console.log(`❌ Failed to fetch DNS records for ${domainName} - no result in response`);
                throw new Error(`Failed to fetch DNS records: ${existingRecords?.errors?.[0]?.message || 'Unknown error'}`);
            }
            
            console.log(`📊 Found ${existingRecords.result.length} existing DNS records for ${domainName}`);
            
            const dnsRecordIds = [];
            
            // Process each DNS record
            for (const dnsRecordName of dnsRecordNames) {
                const name = dnsRecordName === "@" ? domainName : `${dnsRecordName}.${domainName}`;
                console.log(`\n  🔧 Processing DNS record: ${name}`);
                
                // Find existing record
                const existingRecord = (existingRecords.result as CloudflareDnsRecord[]).find(
                    (record: CloudflareDnsRecord) => record.name === name && record.type === "A"
                );

                let recordResponse;
                if (existingRecord) {
                    // Update existing record
                    console.log(`  🔄 Updating existing A record for ${name}, record ID: ${existingRecord.id}`);
                    console.log(`  📝 Update parameters:`, {
                        zoneId,
                        recordId: existingRecord.id,
                        newIp: currentIp
                    });
                    
                    recordResponse = await updateDnsRecord(
                        authKey,
                        authEmail,
                        zoneId,
                        existingRecord.id,
                        existingRecord,
                        currentIp
                    );
                    console.log(`  📋 Update DNS record response for ${name}:`, JSON.stringify(recordResponse, null, 2));
                } else {
                    // Create new record
                    console.log(`  🆕 Creating new A record for ${name}`);
                    console.log(`  📝 Create parameters:`, {
                        zoneId,
                        name,
                        ip: currentIp
                    });
                    
                    recordResponse = await createDnsRecord(
                        authKey,
                        authEmail,
                        zoneId,
                        name,
                        currentIp
                    );
                    console.log(`  📋 Create DNS record response for ${name}:`, JSON.stringify(recordResponse, null, 2));
                }
                
                if (!recordResponse || !recordResponse.result) {
                    console.log(`  ❌ DNS record operation failed for ${name} - no result in response`);
                    throw new Error(`DNS record operation failed for ${name}: ${recordResponse?.errors?.[0]?.message || 'Unknown error'}`);
                }
                
                if (!recordResponse.result.name) {
                    console.log(`  ❌ DNS record operation failed for ${name} - no name in result`);
                    throw new Error(`DNS record operation returned no name: ${JSON.stringify(recordResponse.result)}`);
                }
                
                dnsRecordIds.push(recordResponse.result.name);
                console.log(`  ✅ Successfully processed DNS record for ${name}`);
            }

            results.push({
                domain: domainName,
                ip: currentIp,
                status: "success",
                action: action,
                dns_record_ids: dnsRecordIds
            });

            console.log(`✅ Successfully completed processing for ${domainName}`);

            // Increment IP for next domain (only for non-file modes)
            if (mode === "increment") {
                currentIpLastOctet++;
            } else if (mode === "decrement") {
                currentIpLastOctet--;
            }

        } catch (error) {
            console.log(`❌ Error processing domain ${domainName}:`);
            console.log(`Error details:`, error);
            console.log(`Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
            
            const errorIp = mode === "file" ? 
                (domainIpMap[domainName] || "unknown") : 
                `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${currentIpLastOctet}`;
                
            errors.push({
                domain: domainName,
                ip: errorIp,
                error: error instanceof Error ? error.message : "Unknown error occurred"
            });
            
            // Still increment IP for next domain (only for non-file modes)
            if (mode === "increment") {
                currentIpLastOctet++;
            } else if (mode === "decrement") {
                currentIpLastOctet--;
            }
        }
    }

    res.status(200).json({
        message: "Operation completed",
        mode: mode,
        results,
        errors
    });
});

app.post("/api/v1/cloudflare/updateSslTlsMode", async (req, res) => {
    const body = req.body;
    console.log("SSL/TLS route - Request body keys:", Object.keys(body));
    
    // Try multiple possible key formats
    const authKey = body["X-Auth-Key"] || body["X-AUTH-KEY"] || body["authKey"] || body["api_key"];
    const authEmail = body["X-Auth-Email"] || body["X-AUTH-EMAIL"] || body["authEmail"] || body["email"];
    const domains = Array.isArray(body.domain_name) ? body.domain_name : [body.domain_name];
    const sslMode = body.ssl_mode || "full"; // Default to "full" if not specified

    console.log("SSL/TLS route - Extracted authKey exists:", !!authKey);
    console.log("SSL/TLS route - Extracted authEmail exists:", !!authEmail);

    // Check auth key and email
    if (!authKey || !authEmail) {
        return res.status(401).json({ 
            message: "Unauthorized",
            received_keys: Object.keys(body),
            authKey_found: !!authKey,
            authEmail_found: !!authEmail
        });
    }

    // Bad requests
    if (!domains.length || !sslMode) {
        return res.status(400).json({ message: "Bad Request: domain_name and ssl_mode are required" });
    }

    // Validate SSL mode
    const validSslModes = ["off", "flexible", "full", "strict"];
    if (!validSslModes.includes(sslMode)) {
        return res.status(400).json({ 
            message: "Bad Request: ssl_mode must be one of: off, flexible, full, strict" 
        });
    }

    const results = [];
    const errors = [];

    // Fetch ALL existing zones (handling pagination)
    const zoneMap = new Map<string, CloudflareZone>();
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
        const existingZones = await fetchAllZones(authKey, authEmail, page);
        
        console.log(`Page ${page}: API Response success:`, existingZones.success);
        console.log(`Page ${page}: Result type:`, typeof existingZones.result);
        console.log(`Page ${page}: Result length:`, existingZones.result?.length);
        console.log(`Page ${page}: Full response:`, JSON.stringify(existingZones, null, 2));
        
        // Check if we have valid results
        if (!existingZones.result || !Array.isArray(existingZones.result)) {
            console.log(`Page ${page}: Invalid result, stopping pagination`);
            if (existingZones.errors) {
                console.log(`API Errors:`, JSON.stringify(existingZones.errors, null, 2));
            }
            hasMorePages = false;
            break;
        }
        
        // Add zones to our map
        (existingZones.result as CloudflareZone[]).forEach((zone: CloudflareZone) => {
            console.log(`Adding zone: ${zone.name}`);
            zoneMap.set(zone.name, zone);
        });
        
        // Check if we need to fetch more pages
        if (existingZones.result.length === 0 || existingZones.result.length < 50) {
            hasMorePages = false;
        } else {
            page++;
        }
    }

    console.log(`Found ${zoneMap.size} zones in Cloudflare account`);
    console.log(`Zone names:`, Array.from(zoneMap.keys()));

    // Process each domain
    for (const domainName of domains) {
        try {
            // Check if zone exists
            const existingZone = zoneMap.get(domainName);
            if (!existingZone) {
                errors.push({
                    domain: domainName,
                    error: "Zone not found in Cloudflare account"
                });
                continue;
            }

            // Update SSL/TLS settings
            const updateResponse = await updateSslTlsSettings(authKey, authEmail, existingZone.id, sslMode);
            
            if (updateResponse.success) {
                results.push({
                    domain: domainName,
                    zone_id: existingZone.id,
                    ssl_mode: sslMode,
                    status: "success"
                });
                console.log(`Updated SSL/TLS mode for ${domainName} to ${sslMode}`);
            } else {
                errors.push({
                    domain: domainName,
                    error: updateResponse.errors ? updateResponse.errors[0]?.message : "Failed to update SSL/TLS settings"
                });
            }

        } catch (error) {
            errors.push({
                domain: domainName,
                error: error instanceof Error ? error.message : "Unknown error occurred"
            });
        }
    }

    res.status(200).json({
        message: "SSL/TLS update operation completed",
        ssl_mode: sslMode,
        results,
        errors
    });
});

// Debug route to test zone fetching
app.post("/api/v1/cloudflare/debug/listZones", async (req, res) => {
    const body = req.body;
    console.log("Debug route - Request body keys:", Object.keys(body));
    
    // Try multiple possible key formats
    const authKey = body["X-Auth-Key"] || body["X-AUTH-KEY"] || body["authKey"] || body["api_key"];
    const authEmail = body["X-Auth-Email"] || body["X-AUTH-EMAIL"] || body["authEmail"] || body["email"];

    console.log("Debug route - Extracted authKey exists:", !!authKey);
    console.log("Debug route - Extracted authEmail exists:", !!authEmail);

    // Check auth key and email
    if (!authKey || !authEmail) {
        return res.status(401).json({ 
            message: "Unauthorized",
            received_keys: Object.keys(body),
            authKey_found: !!authKey,
            authEmail_found: !!authEmail
        });
    }

    try {
        console.log("Debug route called with authKey length:", authKey?.length);
        console.log("Debug route called with authEmail:", authEmail);
        
        const zones = await fetchAllZones(authKey, authEmail, 1);
        console.log("Debug route - Full API response:", JSON.stringify(zones, null, 2));
        
        res.status(200).json({
            success: zones.success,
            result_count: zones.result?.length || 0,
            zones: zones.result?.map((zone: any) => ({ id: zone.id, name: zone.name })) || [],
            errors: zones.errors || [],
            full_response: zones
        });
    } catch (error) {
        console.log("Debug route error:", error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error occurred"
        });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

