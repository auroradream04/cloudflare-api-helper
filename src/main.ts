import dotenv from "dotenv"
import express from "express";
import { checkApiKey, createDnsRecord, createZone, fetchAllDnsRecords, fetchAllZones, updateDnsRecord } from "./util";

// Load environment variables as early as possible
dotenv.config();

const port = process.env.PORT || 3000;
const app = express();

app.use(express.json());


app.get("/", (req, res) => {
    res.send("Hello World");
});

app.post("/api/v1/cloudflare/getAllZones", async (req, res) => {
    const body = req.body;
    const apiKey = body.API_KEY;
    const bearerToken = req.headers.authorization as string;
    const page = parseInt(req.body.page || "1");

    // Check api key
    if (!checkApiKey(apiKey)) {
        res.status(401).json({ message: "Unauthorized" });
    }

    // Check bearer token
    if (!bearerToken) {
        res.status(401).json({ message: "Unauthorized" });
    }

    // Fetch all zones
    const data = await fetchAllZones(bearerToken, page);

    res.status(200).json(data);
});

app.post("/api/v1/cloudflare/updateAllDnsRecord", async (req, res) => {
    const body = req.body;
    const apiKey = body.API_KEY;
    const bearerToken = req.headers.authorization as string;
    const domainListEndpoint = req.body.domain_list_endpoint;
    const newIp = req.body.new_ip;

    // Check api key
    if (!checkApiKey(apiKey)) {
        res.status(401).json({ message: "Unauthorized" });
    }

    // Check bearer token
    if (!bearerToken) {
        res.status(401).json({ message: "Unauthorized" });
    }

    // Check domain list endpoint
    if (!domainListEndpoint) {
        res.status(400).json({ message: "Bad Request" });
    }

    // Fetch domain list
    const domainListResponse = await fetch(domainListEndpoint);
    const domainList = (await domainListResponse.text()).split("\n");

    // Fetch all zones
    const allZones = await fetchAllZones(bearerToken, 1);

    // Loop through each zone
    for (const zone of allZones.result) {
        const zoneId = zone.id;
        const zoneName = zone.name;

        // Check if the zone name is in the domain list
        if (domainList.includes(zoneName)) {
            // Fetch all DNS records
            const dnsRecords = await fetchAllDnsRecords(bearerToken, zoneId);

            // Loop through each DNS record
            for (const record of dnsRecords.result) {
                const recordId = record.id;
                const recordName = record.name;
                const recordType = record.type;

                // Update the DNS record with the new IP
                if (recordType === "A") {
                    const updateDnsRecordResponse = await updateDnsRecord(bearerToken, zoneId, recordId, record, newIp);
                }

            }
        }
    }


    res.status(200).json({ message: "Success" });
});

app.post("/api/v1/cloudflare/createZoneWithDnsRecord", async (req, res) => {
    const body = req.body;
    const apiKey = body.API_KEY;
    const domainName = req.body.domain_name;
    const dnsRecordNames = req.body.dns_record_names;
    const accountId = req.body.account_id;
    const type = req.body.type;
    const ip = req.body.ip;
    const authKey = req.body["X-Auth-Key"];
    const authEmail = req.body["X-Auth-Email"];

    // Check api key
    if (!checkApiKey(apiKey)) {
        res.status(401).json({ message: "Unauthorized" });
    }

    // Check auth key
    if (!authKey) {
        res.status(401).json({ message: "Unauthorized" });
    }

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
