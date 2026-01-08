import ApiError from '../errors/errors.js';
import { dbClient } from '../config/supabase.js';

/**
 * Middleware to authenticate requests using API key
 * Expects API key in one of:
 * - X-API-Key header
 * - Authorization header as: ApiKey <key>
 * - api_key query parameter
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const validateApiKey = async (req, res, next) => {
  try {

    // Try to get API key from various sources
    let apiKey = req.headers['x-api-key'] || 
                 req.headers['X-API-Key'] ||
                 req.query.api_key;

    // Also check Authorization header for ApiKey format
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('ApiKey ')) {
      apiKey = authHeader.substring(7); // Remove 'ApiKey ' prefix
    }

    if (!apiKey) {
      throw ApiError.unauthorized('API key is required. Provide it via X-API-Key header, Authorization: ApiKey <key> header, or api_key query parameter');
    }

    // Validate API key against database
    const { data: apiKeyRecord, error } = await dbClient
      .from('api_keys')
      .select('*')
      .eq('key', apiKey)
      .is('deleted_at', null)
      .single();

    if (error || !apiKeyRecord) {
      throw ApiError.unauthorized('Invalid API key');
    }

    // Check if API key is active
    if (apiKeyRecord.status !== 'active') {
      throw ApiError.unauthorized('API key is not active');
    }

    // Optionally check expiration date if you have one
    if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
      throw ApiError.unauthorized('API key has expired');
    }

    // Attach API key info to request object for potential use in routes
    req.apiKey = apiKeyRecord;
    
    // Extract and attach tenant_id from API key to request
    if (apiKeyRecord.tenant_id) {
      req.tenant_id = apiKeyRecord.tenant_id;
    }

    // Optionally update last_used_at timestamp
    await dbClient
      .from('api_keys')
      .update({ 
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', apiKeyRecord.id);

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(ApiError.unauthorized('API key validation failed'));
    }
  }
};

export default validateApiKey;