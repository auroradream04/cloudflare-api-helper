# Cloudflare API Integration

This project provides a set of utilities and an Express server to interact with the Cloudflare API. It allows you to manage zones and DNS records programmatically.

## Features

- Fetch all zones
- Fetch all DNS records for a zone
- Create a new zone
- Create a new DNS record
- Update an existing DNS record

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

### Running the Server

Start the Express server:
```sh
npm start
```

### API Endpoints

1. `POST /api/v1/cloudflare/getAllZones`
   - Description: Fetch all zones for a Cloudflare account
   - Request body:
     ```json
     {
       "X-Auth-Key": "your_auth_key",
       "X-Auth-Email": "your_auth_email",
       "page": "1" // Optional, defaults to 1
     }
     ```
   - Response: JSON object containing zone data

2. `POST /api/v1/cloudflare/updateAllDnsRecord`
   - Description: Update all DNS A records for specified domains to a new IP address
   - Request body:
     ```json
     {
       "X-Auth-Key": "your_auth_key",
       "X-Auth-Email": "your_auth_email",
       "domains": ["domain1.com", "domain2.com"], // Optional: List of domains to update
       "domain_list_endpoint": "https://example.com/domains", // Optional: URL to fetch domain list
       "new_ip": "192.168.1.1" // New IP address
     }
     ```
   - Response: JSON object with success message

3. `POST /api/v1/cloudflare/createZoneWithDnsRecord`
   - Description: Create new zones and add DNS records with automatically incrementing IP addresses
   - Request body:
     ```json
     {
       "X-Auth-Key": "your_auth_key",
       "X-Auth-Email": "your_auth_email",
       "domain_name": ["example1.com", "example2.com", "example3.com"],  // Single domain or array of domains
       "dns_record_names": ["@", "www", "subdomain"],
       "account_id": "your_account_id",
       "type": "full", // Zone type
       "ip": "160.121.75.132" // Starting IP address - will increment for each domain
     }
     ```
   - Response:
     ```json
     {
       "message": "Operation completed",
       "results": [
         {
           "domain": "example1.com",
           "ip": "160.121.75.132",
           "status": "success",
           "dns_record_ids": ["example1.com", "www.example1.com", "subdomain.example1.com"]
         },
         {
           "domain": "example2.com",
           "ip": "160.121.75.133",
           "status": "success",
           "dns_record_ids": ["example2.com", "www.example2.com", "subdomain.example2.com"]
         },
         {
           "domain": "example3.com",
           "ip": "160.121.75.134",
           "status": "success",
           "dns_record_ids": ["example3.com", "www.example3.com", "subdomain.example3.com"]
         }
       ],
       "errors": []
     }
     ```
   - Notes: 
     - The IP address will automatically increment for each domain (last octet only)
     - Each domain will have all specified DNS records pointing to its assigned IP
     - You can provide either a single domain as a string or multiple domains as an array

Note: All endpoints require authentication using the API_KEY, X-Auth-Key, and X-Auth-Email. Make sure to replace these with your actual Cloudflare API credentials.

For more details on the implementation, please refer to the source code.


## License

This project is licensed under the MIT License.
