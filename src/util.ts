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

export const fetchAllZones = async (bearerToken: string, page: number) => {
    const response = await fetch(listZoneEndpoint + "?per_page=500&page=" + page, {
        headers: {
            "Authorization": bearerToken as string
        }
    });

    const data = await response.json();
    return data;
}

export const fetchAllDnsRecords = async (bearerToken: string, zoneId: string) => {
    const response = await fetch(listZoneEndpoint + "/" + zoneId + "/dns_records", {
        headers: {
            "Authorization": bearerToken as string
        }
    });

    const data = await response.json();
    return data;

}

export const updateDnsRecord = async (bearerToken: string, zoneId: string, recordId: string, record: any, newIp: string) => {
    const response = await fetch(listZoneEndpoint + "/" + zoneId + "/dns_records/" + recordId, {
        method: "PATCH",
        headers: {
            "Authorization": bearerToken as string
        },
        body: JSON.stringify({
            content: newIp
        })
    });

    const data = await response.json();
    return data;
}

