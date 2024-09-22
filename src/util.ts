import dotenv from "dotenv";

dotenv.config();

const listZoneEndpoint = "https://api.cloudflare.com/client/v4/zones";

export const checkApiKey = (key: string) => {
    const apiKey = process.env.API_KEY;
    if (key === apiKey) {
        return true;
    }
    return false;
}

export const fetchAllZones = async (authKey: string, authEmail: string, page: number) => {
    const response = await fetch(listZoneEndpoint + "?per_page=500&page=" + page, {
        headers: {
            "X-Auth-Key": authKey as string,
            "X-Auth-Email": authEmail as string,
            "Content-Type": "application/json"
        }
    });

    const data = await response.json();
    return data;
}

export const fetchAllDnsRecords = async (authKey: string, authEmail: string, zoneId: string) => {
    const response = await fetch(listZoneEndpoint + "/" + zoneId + "/dns_records", {
        headers: {
            "X-Auth-Key": authKey as string,
            "X-Auth-Email": authEmail as string,
            "Content-Type": "application/json"
        }
    });

    const data = await response.json();
    return data;

}

export const updateDnsRecord = async (authKey: string, authEmail: string, zoneId: string, recordId: string, record: any, newIp: string) => {
    const response = await fetch(listZoneEndpoint + "/" + zoneId + "/dns_records/" + recordId, {
        method: "PATCH",
        headers: {
            "X-Auth-Key": authKey as string,
            "X-Auth-Email": authEmail as string,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: newIp
        })
    });

    const data = await response.json();
    return data;
}

export const createZone = async (authKey: string, authEmail: string, zoneName: string, accountId: string, type: string) => {
    const response = await fetch(listZoneEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Auth-Key": authKey,
            "X-Auth-Email": authEmail
        },
        body: JSON.stringify({
            name: zoneName,
            type: type,
            account: {
                id: accountId
            }
        })
    });

    const data = await response.json();
    return data;
}

export const createDnsRecord = async (authKey: string, authEmail: string, zoneId: string, dnsRecordName: string[], newIp: string) => {
    const response = await fetch(listZoneEndpoint + "/" + zoneId + "/dns_records", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Auth-Key": authKey,
            "X-Auth-Email": authEmail
        },
        body: JSON.stringify({
            name: dnsRecordName,
            type: "A",
            content: newIp
        })
    });

    const data = await response.json();
    return data;
}

