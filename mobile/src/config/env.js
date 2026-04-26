const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://smart-health-backend-2idf.onrender.com';
const DEFAULT_SOS_API_BASE_URL = process.env.EXPO_PUBLIC_SOS_API_BASE_URL || 'http://localhost:5001';
const DEFAULT_WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://smart-health-rontend.onrender.com';

function resolveForPhysicalDevice(rawUrl) {
	if (!rawUrl) {
		return rawUrl;
	}

	try {
		const url = new URL(rawUrl);
		const lanIp = process.env.EXPO_PUBLIC_LOCAL_NETWORK_IP;
		const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

		// On a physical phone localhost points to the phone itself.
		// If a LAN IP is provided, swap localhost automatically.
		if (isLocalhost && lanIp) {
			url.hostname = lanIp;
			return url.toString().replace(/\/$/, '');
		}

		return rawUrl;
	} catch {
		return rawUrl;
	}
}

export const API_BASE_URL = resolveForPhysicalDevice(DEFAULT_API_BASE_URL);
export const SOS_API_BASE_URL = resolveForPhysicalDevice(DEFAULT_SOS_API_BASE_URL);
export const WEB_APP_URL = resolveForPhysicalDevice(DEFAULT_WEB_APP_URL);
