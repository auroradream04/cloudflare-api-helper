import dotenv from "dotenv";

dotenv.config();

const listZoneEndpoint = "https://api.cloudflare.com/client/v4/zones";

export const fetchAllZones = async (authKey: string, authEmail: string, page: number) => {
    const response = await fetch(listZoneEndpoint + "?per_page=500&page=" + page, {
        headers: {
            "X-AUTH-KEY": authKey as string,
            "X-AUTH-EMAIL": authEmail as string,
            "Content-Type": "application/json"
        }
    });

    const data = await response.json();
    return data;
}

export const fetchAllDnsRecords = async (authKey: string, authEmail: string, zoneId: string) => {
    const response = await fetch(listZoneEndpoint + "/" + zoneId + "/dns_records", {
        headers: {
            "X-AUTH-KEY": authKey as string,
            "X-AUTH-EMAIL": authEmail as string,
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
            "X-AUTH-KEY": authKey as string,
            "X-AUTH-EMAIL": authEmail as string,
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
            "X-AUTH-KEY": authKey,
            "X-AUTH-EMAIL": authEmail
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
            "X-AUTH-KEY": authKey,
            "X-AUTH-EMAIL": authEmail
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

export const updateSslTlsSettings = async (authKey: string, authEmail: string, zoneId: string, sslMode: string) => {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/ssl`, {
        method: "PATCH",
        headers: {
            "X-AUTH-KEY": authKey,
            "X-AUTH-EMAIL": authEmail,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            value: sslMode
        })
    });

    const data = await response.json();
    return data;
}

