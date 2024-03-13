import TonConnect, { isWalletInfoRemote } from '@tonconnect/sdk';
import { FSStorage } from './storage';
import path from 'path';
import qrcode from 'qrcode-terminal';

const storagePath = path.join(process.cwd(), 'temp', 'ton-connect.json');

export async function getConnector(): Promise<TonConnect> {
    const connector = new TonConnect({
        manifestUrl:
            'https://raw.githubusercontent.com/ton-defi-org/tonconnect-manifest-temp/main/tonconnect-manifest.json',
        storage: new FSStorage(storagePath),
    });
    await connector.restoreConnection();
    if (connector.connected) {
        return connector;
    }
    const walletsList = await connector.getWallets();
    const remoteWalletsList = walletsList.filter(isWalletInfoRemote);
    const walletInfo = remoteWalletsList.find((wallet) => wallet.appName === 'tonkeeper');
    const url = connector.connect({
        universalLink: walletInfo!.universalLink,
        bridgeUrl: walletInfo!.bridgeUrl,
    });
    qrcode.generate(url, { small: true });
    console.log(url);
    connector.onStatusChange((wallet) => {
        if (wallet) {
            console.log(wallet);
        }
    });

    return new Promise<TonConnect>((resolve) => {
        connector.onStatusChange((wallet) => {
            if (wallet) {
                resolve(connector);
            }
        });
    });
}
