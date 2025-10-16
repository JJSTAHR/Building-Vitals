/**
 * AI-Powered Point Enhancer
 * Version: 1.0.0
 *
 * Uses Cloudflare AI (Workers AI) and Vectorize for:
 * - Full AI enhancement (embedding + LLM generation)
 * - AI validation (semantic similarity search only)
 */

import { generateEmbeddings, findSimilarPoints } from '../../workers/vectorize-embeddings.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const AI_CONFIG = {
  // Models
  EMBEDDING_MODEL: '@cf/baai/bge-base-en-v1.5',
  LLM_MODEL: '@cf/meta/llama-3.1-8b-instruct',

  // Search parameters
  SIMILARITY_THRESHOLD: 0.75,
  TOP_K_SIMILAR: 3,

  // Generation parameters
  MAX_TOKENS: 256,
  TEMPERATURE: 0.3
};

// ============================================================================
// FULL AI ENHANCEMENT
// ============================================================================

/**
 * Full AI enhancement using embeddings and LLM
 * @param {Object} point - Raw point object
 * @param {Object} ruleBased - Rule-based enhancement result
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} AI-enhanced point
 */
export async function enhanceWithAI(point, ruleBased, env) {
  const startTime = Date.now();
  const pointName = point.Name || point.name || '';

  try {
    console.log('[AI-FULL] Starting full AI enhancement:', pointName);

    // Step 1: Generate embedding for this point
    const embedding = await generatePointEmbedding(point, env);

    // Step 2: Find similar points for context
    let similarPoints = [];
    try {
      if (embedding && embedding.id) {
        similarPoints = await findSimilarPoints(embedding.id, AI_CONFIG.TOP_K_SIMILAR, env, true);
      }
    } catch (error) {
      console.warn('[AI-FULL] Could not find similar points:', error.message);
      // Continue without similar points
    }

    // Step 3: Build context for LLM
    const context = buildEnhancementContext(point, ruleBased, similarPoints);

    // Step 4: Generate enhancement using LLM
    const llmResult = await generateWithLLM(context, env);

    // Step 5: Merge results
    const enhanced = {
      ...ruleBased,
      ...llmResult,

      // AI-specific metadata
      aiEnhanced: true,
      similarPoints: similarPoints.slice(0, 2).map(sp => ({
        name: sp.point.display_name,
        similarity: sp.similarity,
        equipment: sp.point.equipment
      })),
      embeddingId: embedding?.id || null,

      // Update confidence and source
      confidence: calculateAIConfidence(ruleBased.confidence, llmResult, similarPoints),
      source: 'ai-full',
      processingTime: Date.now() - startTime,
      _enhancedAt: new Date().toISOString()
    };

    console.log('[AI-FULL] Enhancement complete:', {
      pointName,
      confidence: enhanced.confidence,
      duration: Date.now() - startTime
    });

    return enhanced;
  } catch (error) {
    console.error('[AI-FULL] Error in AI enhancement:', error);

    // Fallback to rule-based with error flag
    return {
      ...ruleBased,
      aiEnhanced: false,
      aiError: error.message,
      source: 'ai-full-error',
      confidence: Math.max(50, ruleBased.confidence - 10),
      _enhancedAt: new Date().toISOString()
    };
  }
}

// ============================================================================
// AI VALIDATION
// ============================================================================

/**
 * Validate rule-based enhancement using AI (semantic search only)
 * @param {Object} ruleBased - Rule-based enhancement result
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} Validated point
 */
export async function validateWithAI(ruleBased, env) {
  const startTime = Date.now();
  const pointName = ruleBased.name || '';

  try {
    console.log('[AI-VALIDATE] Validating with semantic search:', pointName);

    // Step 1: Generate embedding for this point
    const embedding = await generatePointEmbedding(ruleBased, env);

    // Step 2: Find similar points
    let similarPoints = [];
    if (embedding && embedding.id) {
      similarPoints = await findSimilarPoints(embedding.id, AI_CONFIG.TOP_K_SIMILAR, env, true);
    }

    // Step 3: Validate classifications against similar points
    const validation = validateAgainstSimilar(ruleBased, similarPoints);

    // Step 4: Build validated result
    const validated = {
      ...ruleBased,

      // Update based on validation
      equipment: validation.equipment || ruleBased.equipment,
      equipmentType: validation.equipmentType || ruleBased.equipmentType,
      system: validation.system || ruleBased.system,
      pointType: validation.pointType || ruleBased.pointType,

      // Validation metadata
      aiValidated: true,
      validation: {
        passed: validation.passed,
        changes: validation.changes,
        confidence: validation.confidence
      },
      similarPoints: similarPoints.slice(0, 2).map(sp => ({
        name: sp.point.display_name,
        similarity: sp.similarity,
        equipment: sp.point.equipment
      })),
      embeddingId: embedding?.id || null,

      // Update confidence
      confidence: validation.confidence,
      source: 'ai-validated',
      processingTime: Date.now() - startTime,
      _enhancedAt: new Date().toISOString()
    };

    console.log('[AI-VALIDATE] Validation complete:', {
      pointName,
      passed: validation.passed,
      confidence: validated.confidence,
      duration: Date.now() - startTime
    });

    return validated;
  } catch (error) {
    console.error('[AI-VALIDATE] Error in AI validation:', error);

    // Return rule-based result unchanged
    return {
      ...ruleBased,
      aiValidated: false,
      aiError: error.message,
      source: 'ai-validated-error',
      _enhancedAt: new Date().toISOString()
    };
  }
}

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

/**
 * Generate embedding for a single point
 * @param {Object} point - Point object
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} Embedding object
 */
async function generatePointEmbedding(point, env) {
  try {
    // Build searchable text
    const text = [
      point.display_name || point.Name || '',
      point.equipment || '',
      point.equipmentType || '',
      point.system || '',
      point.pointType || '',
      point.unit || '',
      Array.isArray(point.marker_tags) ? point.marker_tags.join(' ') : ''
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .trim();

    // Generate embedding
    const response = await env.AI.run(AI_CONFIG.EMBEDDING_MODEL, {
      text: [text]
    });

    if (!response?.data || !Array.isArray(response.data) || response.data.length === 0) {
      throw new Error('Invalid embedding response');
    }

    // Create embedding object
    const embedding = {
      id: point.name || point.Name || `point_${Date.now()}`,
      values: response.data[0],
      metadata: {
        name: point.Name || point.name || '',
        display_name: point.display_name || point.Name || '',
        equipment: point.equipment || '',
        equipmentType: point.equipmentType || '',
        system: point.system || '',
        pointType: point.pointType || '',
        unit: point.unit || '',
        marker_tags: point.marker_tags || []
      }
    };

    // Store in Vectorize
    if (env.VECTORIZE_INDEX) {
      try {
        await env.VECTORIZE_INDEX.upsert([embedding]);
      } catch (upsertError) {
        console.warn('[AI] Could not store embedding in Vectorize:', upsertError.message);
        // Continue without storing
      }
    }

    return embedding;
  } catch (error) {
    console.error('[AI] Error generating embedding:', error);
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

// ============================================================================
// LLM GENERATION
// ============================================================================

/**
 * Generate enhancement using LLM
 * @param {Object} context - Enhancement context
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} LLM-generated enhancement
 */
async function generateWithLLM(context, env) {
  try {
    const prompt = buildEnhancementPrompt(context);

    const response = await env.AI.run(AI_CONFIG.LLM_MODEL, {
      messages: [
        {
          role: 'system',
          content: 'You are an expert in building automation systems. Analyze point names and provide accurate equipment and point type classifications. Respond with JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: AI_CONFIG.MAX_TOKENS,
      temperature: AI_CONFIG.TEMPERATURE
    });

    // Parse LLM response
    const generated = parseLLMResponse(response);

    return generated;
  } catch (error) {
    console.error('[AI] Error generating with LLM:', error);
    return {}; // Return empty object, will use rule-based fallback
  }
}

/**
 * Build prompt for LLM
 * @param {Object} context - Enhancement context
 * @returns {string} Formatted prompt
 */
function buildEnhancementPrompt(context) {
  const { point, ruleBased, similarPoints } = context;

  let prompt = `Analyze this building automation point and provide accurate classification:

Point Name: ${point.Name || point.name}
Current Display Name: ${ruleBased.display_name}

Rule-Based Classification:
- Equipment: ${ruleBased.equipment}
- Equipment Type: ${ruleBased.equipmentType}
- System: ${ruleBased.system}
- Point Type: ${ruleBased.pointType}
- Confidence: ${ruleBased.confidence}%
`;

  if (similarPoints && similarPoints.length > 0) {
    prompt += `\nSimilar Points for Context:\n`;
    similarPoints.forEach((sp, idx) => {
      prompt += `${idx + 1}. ${sp.point.display_name} (${(sp.similarity * 100).toFixed(1)}% similar)
   Equipment: ${sp.point.equipment}, Type: ${sp.point.equipmentType}\n`;
    });
  }

  prompt += `
Respond with JSON in this format:
{
  "display_name": "improved human-readable name",
  "equipment": "equipment type",
  "equipmentType": "equipment category",
  "system": "system name",
  "pointType": "point type",
  "description": "brief description",
  "confidence": 90
}`;

  return prompt;
}

/**
 * Parse LLM response
 * @param {Object} response - LLM response
 * @returns {Object} Parsed enhancement data
 */
function parseLLMResponse(response) {
  try {
    const content = response?.response || response?.content || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {};
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      display_name: parsed.display_name || undefined,
      equipment: parsed.equipment || undefined,
      equipmentType: parsed.equipmentType || undefined,
      system: parsed.system || undefined,
      pointType: parsed.pointType || undefined,
      description: parsed.description || undefined,
      llmConfidence: parsed.confidence || undefined
    };
  } catch (error) {
    console.error('[AI] Error parsing LLM response:', error);
    return {};
  }
}

// ============================================================================
// VALIDATION LOGIC
// ============================================================================

/**
 * Validate rule-based enhancement against similar points
 * @param {Object} ruleBased - Rule-based result
 * @param {Array} similarPoints - Similar points from vector search
 * @returns {Object} Validation result
 */
function validateAgainstSimilar(ruleBased, similarPoints) {
  if (!similarPoints || similarPoints.length === 0) {
    return {
      passed: true,
      changes: [],
      confidence: ruleBased.confidence,
      reason: 'No similar points for validation'
    };
  }

  const changes = [];
  let updatedFields = {};

  // Check equipment consistency
  const equipmentVotes = {};
  similarPoints.forEach(sp => {
    const eq = sp.point.equipment;
    if (eq && eq !== 'unknown') {
      equipmentVotes[eq] = (equipmentVotes[eq] || 0) + sp.similarity;
    }
  });

  const topEquipment = Object.entries(equipmentVotes)
    .sort((a, b) => b[1] - a[1])[0];

  if (topEquipment && topEquipment[1] > 0.8 && topEquipment[0] !== ruleBased.equipment) {
    changes.push({
      field: 'equipment',
      from: ruleBased.equipment,
      to: topEquipment[0],
      reason: 'Similar points suggest different equipment type'
    });
    updatedFields.equipment = topEquipment[0];
  }

  // Adjust confidence based on validation
  let confidence = ruleBased.confidence;
  if (changes.length === 0) {
    // Validation passed, boost confidence
    confidence = Math.min(95, confidence + 10);
  } else {
    // Made changes, moderate confidence
    confidence = 80;
  }

  return {
    passed: changes.length === 0,
    changes,
    confidence,
    ...updatedFields
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build context for enhancement
 * @param {Object} point - Raw point
 * @param {Object} ruleBased - Rule-based result
 * @param {Array} similarPoints - Similar points
 * @returns {Object} Enhancement context
 */
function buildEnhancementContext(point, ruleBased, similarPoints) {
  return {
    point,
    ruleBased,
    similarPoints: similarPoints || []
  };
}

/**
 * Calculate AI-enhanced confidence
 * @param {number} ruleBasedConfidence - Original confidence
 * @param {Object} llmResult - LLM result
 * @param {Array} similarPoints - Similar points
 * @returns {number} Final confidence score
 */
function calculateAIConfidence(ruleBasedConfidence, llmResult, similarPoints) {
  let confidence = ruleBasedConfidence;

  // Boost from LLM
  if (llmResult.llmConfidence) {
    confidence = (confidence * 0.4) + (llmResult.llmConfidence * 0.6);
  }

  // Boost from similar points
  if (similarPoints && similarPoints.length > 0) {
    const avgSimilarity = similarPoints.reduce((sum, sp) => sum + sp.similarity, 0) / similarPoints.length;
    if (avgSimilarity > 0.8) {
      confidence = Math.min(95, confidence + 5);
    }
  }

  return Math.round(Math.max(0, Math.min(100, confidence)));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  enhanceWithAI,
  validateWithAI,
  AI_CONFIG
};
