# Cloudflare API Integration

This project provides a set of utilities and an Express server to interact with the Cloudflare API. It allows you to manage zones and DNS records programmatically with multiple operation modes including file-based domain management.

## Features

- Fetch all zones
- Fetch all DNS records for a zone
- Create a new zone
- Create a new DNS record
- Update an existing DNS record
- Upsert zones with DNS records (create or update)
- File-based domain management with IP mappings
- SSL/TLS mode configuration
- Multiple IP assignment modes (increment, decrement, static, file)

## Getting Started

### Prerequisites

- Node.js
- npm (Node Package Manager)
- Cloudflare account with API key and email

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/auroradream04/cloudflare-api-integration.git
    cd cloudflare-api-integration
    ```

2. Install the dependencies:
    ```sh
    npm install
    ```

3. Create a `.env` file in the root directory and add your Cloudflare API key and email:
    ```env
    API_KEY=create_your_own_api_key
    PORT=3000
    ```

4. (Optional) For file mode operations, create a `domains.json` file in the root directory:
    ```json
    {
      "example1.com": "192.168.1.100",
      "example2.com": "192.168.1.101",
      "example3.com": "192.168.1.102"
    }
    ```

### Running the Server

Start the Express server:
```sh
npm start
```

### API Endpoints

#### 1. `POST /api/v1/cloudflare/getAllZones`
   - **Description:** Fetch all zones for a Cloudflare account
   - **Request body:**
     ```json
     {
       "X-Auth-Key": "your_auth_key",
       "X-Auth-Email": "your_auth_email",
       "page": "1" // Optional, defaults to 1
     }
     ```
   - **Response:** JSON object containing zone data

#### 2. `POST /api/v1/cloudflare/updateAllDnsRecord`
   - **Description:** Update all DNS A records for specified domains to a new IP address
   - **Request body:**
     ```json
     {
       "X-Auth-Key": "your_auth_key",
       "X-Auth-Email": "your_auth_email",
       "domains": ["domain1.com", "domain2.com"], // Optional: List of domains to update
       "domain_list_endpoint": "https://example.com/domains", // Optional: URL to fetch domain list
       "new_ip": "192.168.1.1" // New IP address
     }
     ```
   - **Response:** JSON object with success message and processed domains

#### 3. `POST /api/v1/cloudflare/createZoneWithDnsRecord`
   - **Description:** Create new zones and add DNS records with automatically incrementing IP addresses
   - **Request body:**
     ```json
     {
       "X-Auth-Key": "your_auth_key",
       "X-Auth-Email": "your_auth_email",
       "domain_name": ["example1.com", "example2.com", "example3.com"],
       "dns_record_names": ["@", "www", "subdomain"],
       "account_id": "your_account_id",
       "type": "full",
       "ip": "160.121.75.132"
     }
     ```
   - **Response:**
     ```json
     {
       "message": "Operation completed",
       "results": [
         {
           "domain": "example1.com",
           "ip": "160.121.75.132",
           "status": "success",
           "dns_record_ids": ["example1.com", "www.example1.com", "subdomain.example1.com"]
         }
       ],
       "errors": []
     }
     ```

#### 4. `POST /api/v1/cloudflare/upsertZoneWithDnsRecord` ⭐ **NEW**
   - **Description:** Create or update zones and DNS records with multiple IP assignment modes
   - **Modes Available:**
     - `increment`: IP addresses increment for each domain (default)
     - `decrement`: IP addresses decrement for each domain
     - `static`: Same IP for all domains
     - `file`: Use domain-to-IP mappings from domains.json file

   ##### **Mode: increment/decrement/static**
   ```json
   {
     "X-Auth-Key": "your_auth_key",
     "X-Auth-Email": "your_auth_email",
     "domain_name": ["example1.com", "example2.com", "example3.com"],
     "dns_record_names": ["@", "www", "m"],
     "account_id": "your_account_id",
     "type": "full",
     "ip": "160.121.75.132",
     "mode": "increment"
   }
   ```

   ##### **Mode: file (Process specific domains)**
   ```json
   {
     "X-Auth-Key": "your_auth_key",
     "X-Auth-Email": "your_auth_email",
     "domain_name": ["example1.com", "example2.com"],
     "dns_record_names": ["@", "www", "m"],
     "account_id": "your_account_id",
     "type": "full",
     "mode": "file"
   }
   ```

   ##### **Mode: file (Process ALL domains from domains.json)**
   ```json
   {
     "X-Auth-Key": "your_auth_key",
     "X-Auth-Email": "your_auth_email",
     "dns_record_names": ["@", "www", "m"],
     "account_id": "your_account_id",
     "type": "full",
     "mode": "file"
   }
   ```
   *Note: When using file mode without specifying domain_name, ALL domains from domains.json will be processed*

   - **Response:**
     ```json
     {
       "message": "Operation completed",
       "mode": "file",
       "results": [
         {
           "domain": "example1.com",
           "ip": "192.168.1.100",
           "status": "success",
           "action": "created",
           "dns_record_ids": ["example1.com", "www.example1.com", "m.example1.com"]
         }
       ],
       "errors": []
     }
     ```

#### 5. `POST /api/v1/cloudflare/updateSslTlsMode`
   - **Description:** Update SSL/TLS mode for specified domains
   - **Request body:**
     ```json
     {
       "X-Auth-Key": "your_auth_key",
       "X-Auth-Email": "your_auth_email",
       "domain_name": ["example1.com", "example2.com"],
       "ssl_mode": "full"
     }
     ```
   - **SSL Modes:** `off`, `flexible`, `full`, `strict`
   - **Response:** JSON object with SSL/TLS update results

#### 6. `POST /api/v1/cloudflare/debug/listZones`
   - **Description:** Debug endpoint to list all zones with detailed logging
   - **Request body:**
     ```json
     {
       "X-Auth-Key": "your_auth_key",
       "X-Auth-Email": "your_auth_email"
     }
     ```

## File Mode Setup

### Creating domains.json

For file mode operations, create a `domains.json` file in the root directory with domain-to-IP mappings:

```json
{
  "example1.com": "192.168.1.100",
  "example2.com": "192.168.1.101",
  "subdomain.example.com": "192.168.1.102",
  "another-domain.org": "10.0.0.50"
}
```

### File Mode Benefits

- **Precise IP Control:** Each domain gets its specific IP address
- **Bulk Operations:** Process hundreds of domains automatically
- **No Manual IP Calculation:** No need to specify starting IPs or calculate increments
- **Flexible Selection:** Process all domains or just specific ones
- **Easy Management:** Update IPs by editing the JSON file

### File Mode Usage Examples

1. **Process ALL domains from domains.json:**
   ```bash
   curl -X POST http://localhost:6100/api/v1/cloudflare/upsertZoneWithDnsRecord \
     -H "Content-Type: application/json" \
     -d '{
       "X-Auth-Key": "your_key",
       "X-Auth-Email": "your_email",
       "dns_record_names": ["@", "www"],
       "account_id": "your_account_id",
       "type": "full",
       "mode": "file"
     }'
   ```

2. **Process specific domains from domains.json:**
   ```bash
   curl -X POST http://localhost:6100/api/v1/cloudflare/upsertZoneWithDnsRecord \
     -H "Content-Type: application/json" \
     -d '{
       "X-Auth-Key": "your_key",
       "X-Auth-Email": "your_email",
       "domain_name": ["example1.com", "example2.com"],
       "dns_record_names": ["@", "www"],
       "account_id": "your_account_id",
       "type": "full",
       "mode": "file"
     }'
   ```

## Authentication

All endpoints require authentication using Cloudflare API credentials:
- **X-Auth-Key:** Your Cloudflare API key
- **X-Auth-Email:** Your Cloudflare account email

## Error Handling

The API provides detailed error responses including:
- Domain-specific error messages
- API response details
- Validation errors
- Network/connectivity issues

## Logging

The application includes comprehensive logging for debugging:
- Request/response details
- Domain processing status
- API call parameters
- Error stack traces
- Success confirmations

## License

This project is licensed under the MIT License.
