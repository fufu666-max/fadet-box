# Time Capsule Deployment Guide

## Prerequisites

- Node.js >= 20.x
- npm >= 9.x
- MetaMask or Rainbow wallet extension
- Git

## Installation

```bash
# Install contract dependencies
npm install

# Install UI dependencies
cd ui
npm install
cd ..
```

## Local Development

### 1. Start Hardhat Node

In a separate terminal:

```bash
npx hardhat node
```

### 2. Deploy Contract

In another terminal:

```bash
# Deploy TimeCapsule contract to local network
npx hardhat deploy --tags TimeCapsule --network localhost
```

After deployment, update the contract address in `ui/src/abi/TimeCapsuleAddresses.ts`:

```typescript
"31337": {
  address: "<DEPLOYED_ADDRESS>",
  chainId: 31337,
  chainName: "hardhat",
},
```

### 3. Run Tests

```bash
# Run local tests
npm run test -- TimeCapsule

# Run Sepolia tests (requires deployed contract)
npm run test -- TimeCapsuleSepolia
```

### 4. Start Frontend

```bash
cd ui
npm run dev
```

Visit `http://localhost:5173` in your browser.

## Contract Interaction (CLI)

### Create a Capsule

```bash
npx hardhat --network localhost task:create-capsule \
  --message "Hello Future" \
  --unlock-timestamp 1735689600
```

### Get Capsule Data

```bash
npx hardhat --network localhost task:get-capsule --id 0
```

### Get User Capsules

```bash
npx hardhat --network localhost task:get-user-capsules
```

### Check if Capsule Can Unlock

```bash
npx hardhat --network localhost task:can-unlock --id 0
```

## Sepolia Deployment

### 1. Configure Environment

Set up Hardhat variables:

```bash
npx hardhat vars set MNEMONIC
npx hardhat vars set INFURA_API_KEY
npx hardhat vars set ETHERSCAN_API_KEY  # Optional, for verification
```

### 2. Deploy to Sepolia

```bash
npx hardhat deploy --tags TimeCapsule --network sepolia
```

### 3. Update Contract Address

Update `ui/src/abi/TimeCapsuleAddresses.ts` with the deployed address:

```typescript
"11155111": {
  address: "<DEPLOYED_ADDRESS>",
  chainId: 11155111,
  chainName: "sepolia",
},
```

### 4. Verify Contract (Optional)

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <DECRYPT_MANAGER_ADDRESS>
```

## Frontend Usage

1. **Connect Wallet**: Click the "Connect Wallet" button in the top right
2. **Switch Network**: Ensure you're on Hardhat Local (31337) or Sepolia (11155111)
3. **Create Capsule**: 
   - Enter your message
   - Select unlock date/time
   - Click "Encrypt & Lock"
4. **View Capsules**: Your capsules will appear in the Vault section
5. **Unlock Capsule**: After the unlock date, click "Unlock" to decrypt

## Testing

### Local Network Tests

```bash
npm run test
```

### Sepolia Network Tests

```bash
npm run test:sepolia
```

## Troubleshooting

### FHEVM Not Initializing

- Ensure Hardhat node is running with FHEVM plugin
- Check that `@fhevm/hardhat-plugin` is imported in `hardhat.config.ts`
- Restart Hardhat node if needed

### Contract Not Deployed

- Verify deployment was successful
- Check contract address in `TimeCapsuleAddresses.ts`
- Ensure you're on the correct network

### Decryption Fails

- Ensure unlock date has passed
- Check that you have permission to decrypt (you're the creator or decrypt manager)
- Verify FHEVM is properly initialized

## Project Structure

```
fadet-box/
├── contracts/
│   └── TimeCapsule.sol          # Main contract
├── deploy/
│   └── deploy_timecapsule.ts    # Deployment script
├── test/
│   ├── TimeCapsule.ts           # Local tests
│   └── TimeCapsuleSepolia.ts    # Sepolia tests
├── tasks/
│   └── TimeCapsule.ts           # CLI tasks
└── ui/
    ├── src/
    │   ├── components/
    │   │   ├── CreateCapsule.tsx
    │   │   └── CapsuleVault.tsx
    │   ├── hooks/
    │   │   └── useFhevm.ts
    │   └── abi/
    │       ├── TimeCapsuleABI.ts
    │       └── TimeCapsuleAddresses.ts
    └── public/
        ├── logo.svg
        └── favicon.svg
```

