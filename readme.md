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
    API_KEY=your_cloudflare_api_key
    PORT=3000
    ```

### Running the Server

Start the Express server:
```sh
npm start
```

### API Endpoints

- `POST /api/v1/cloudflare/getAllZones`: Fetch all zones
- `POST /api/v1/cloudflare/updateAllDnsRecord`: Update all DNS records to a certain IP address
- `POST /api/v1/cloudflare/createZoneWithDnsRecord`: Create a new zone and a new DNS record

For more details on how to use these endpoints, please refer to the source code.


## License

This project is licensed under the MIT License.
