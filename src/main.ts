import dotenv from "dotenv"
import express from "express";
import { createDnsRecord, createZone, fetchAllDnsRecords, fetchAllZones, updateDnsRecord } from "./util";

// Load environment variables as early as possible
dotenv.config();

const port = process.env.PORT || 3000;
const app = express();

app.use(express.json());


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
    const domainName = body.domain_name;
    const dnsRecordNames = body.dns_record_names;
    const accountId = body.account_id;
    const type = body.type;
    const ip = body.ip;

    // Check auth key and email
    if (!authKey || !authEmail) {
        res.status(401).json({ message: "Unauthorized" });
    }

    // Bad requests
    if (!domainName || !dnsRecordNames || !accountId || !type || !ip) {
        res.status(400).json({ message: "Bad Request" });
    }

    // Create a new zone
    const createZoneResponse = await createZone(authKey, authEmail, domainName, accountId, type);

    // Create a new DNS record
    const dnsRecordIds = [];
    for (const dnsRecordName of dnsRecordNames) {
        const name = dnsRecordName === "@" ? domainName : `${dnsRecordName}.${domainName}`;
        const createDnsRecordResponse = await createDnsRecord(authKey, authEmail, createZoneResponse.result.id, name, ip);
        console.log(createDnsRecordResponse);
        dnsRecordIds.push(createDnsRecordResponse.result.name);
    }

    res.status(200).json({ message: "Success", dns_record_ids: dnsRecordIds });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

