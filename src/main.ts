import dotenv from "dotenv"
import express from "express";
import { createDnsRecord, createZone, fetchAllDnsRecords, fetchAllZones, updateDnsRecord } from "./util";

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
    const domains = Array.isArray(body.domain_name) ? body.domain_name : [body.domain_name];
    const dnsRecordNames = body.dns_record_names;
    const accountId = body.account_id;
    const type = body.type;
    const startingIp = body.ip;
    const mode = body.mode;

    // Check auth key and email
    if (!authKey || !authEmail) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    // Bad requests
    if (!domains.length || !dnsRecordNames || !accountId || !type || !startingIp || !mode) {
        return res.status(400).json({ message: "Bad Request" });
    }

    const results = [];
    const errors = [];

    // Split IP into octets for incrementing
    const ipParts = startingIp.split('.');
    let currentIpLastOctet = parseInt(ipParts[3]);

    // Fetch all existing zones first
    const existingZones = await fetchAllZones(authKey, authEmail, 1);
    const zoneMap = new Map(
        (existingZones.result as CloudflareZone[]).map((zone: CloudflareZone) => [zone.name, zone])
    );

    // Process each domain
    for (const domainName of domains) {
        try {
            // Construct current IP
            const currentIp = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${currentIpLastOctet}`;
            let zoneId;
            let action = "created";

            // Check if zone exists
            const existingZone = zoneMap.get(domainName) as CloudflareZone | undefined;
            if (existingZone) {
                // Use existing zone
                zoneId = existingZone.id;
                action = "updated";
            } else {
                // Create new zone
                const createZoneResponse = await createZone(authKey, authEmail, domainName, accountId, type);
                zoneId = createZoneResponse.result.id;
            }

            // Fetch existing DNS records if zone existed
            const existingRecords = action === "updated" 
                ? await fetchAllDnsRecords(authKey, authEmail, zoneId)
                : { result: [] };
            
            const dnsRecordIds = [];
            
            // Process each DNS record
            for (const dnsRecordName of dnsRecordNames) {
                const name = dnsRecordName === "@" ? domainName : `${dnsRecordName}.${domainName}`;
                
                // Find existing record
                const existingRecord = (existingRecords.result as CloudflareDnsRecord[]).find(
                    (record: CloudflareDnsRecord) => record.name === name && record.type === "A"
                );

                let recordResponse;
                if (existingRecord) {
                    // Update existing record
                    recordResponse = await updateDnsRecord(
                        authKey,
                        authEmail,
                        zoneId,
                        existingRecord.id,
                        existingRecord,
                        currentIp
                    );
                } else {
                    // Create new record
                    recordResponse = await createDnsRecord(
                        authKey,
                        authEmail,
                        zoneId,
                        name,
                        currentIp
                    );
                }
                dnsRecordIds.push(recordResponse.result.name);
            }

            results.push({
                domain: domainName,
                ip: currentIp,
                status: "success",
                action: action,
                dns_record_ids: dnsRecordIds
            });

            // Increment IP for next domain
            if (mode === "increment") {
                currentIpLastOctet++;
            } else if (mode === "decrement") {
                currentIpLastOctet--;
            } 

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

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

