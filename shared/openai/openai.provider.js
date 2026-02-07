// Cập nhật file shared/openai/openai.provider.js

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

class OpenAIProvider {
    constructor() {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          organization: process.env.OPENAI_ORGANIZATION
        });
      }
  
  /**
   * Generate chat completion with improved options
   */
  async chat(options) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: options.model || "gpt-3.5-turbo",
        messages: options.messages,
        temperature: options.temperature || 0.3,
        max_tokens: options.max_tokens || 1000,
        top_p: options.top_p || 0.8,
        frequency_penalty: options.frequency_penalty || 0.3,
        presence_penalty: options.presence_penalty || 0.3
      });
      return completion;
    } catch(error) {
      console.log('OpenAI API Error:', error);
      throw error;
    }
  }
  
  /**
   * Generate embeddings for semantic search
   */
  async createEmbedding(input) {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: input
      });
      return response;
    } catch(error) {
      console.log('OpenAI Embedding Error:', error);
      throw error;
    }
  }
  
  /**
   * Upload a file for fine-tuning
   */
  async uploadFile(filePath) {
    try {
      const response = await this.openai.files.create({
        file: fs.createReadStream(filePath),
        purpose: 'fine-tune'
      });
      return response;
    } catch(error) {
      console.log('OpenAI Upload File Error:', error);
      throw error;
    }
  }
  
  /**
   * Create a fine-tuning job
   */
  async fineTune(options) {
    try {
      const fineTuneJob = await this.openai.fineTuning.jobs.create({
        training_file: options.training_file,
        model: "gpt-3.5-turbo",
        hyperparameters: {
          n_epochs: 8,
          batch_size: 8,
          learning_rate_multiplier: 1.5
        }
      });
      return fineTuneJob;
    } catch(error) {
      console.log('OpenAI Fine-tune Error:', error);
      throw error;
    }
  }
  
  /**
   * Wait for and get the model after fine-tuning completes
   */
  async getModelAfterFineTune(jobId, maxWaitTime = 4 * 60 * 60 * 1000) {
    const startTime = Date.now();
    const checkInterval = 30000; // 30 seconds
    let retryCount = 0;
    const maxRetries = 3;
    
    try {
      while (Date.now() - startTime < maxWaitTime) {
        try {
          const fineTuneStatus = await this.openai.fineTuning.jobs.retrieve(jobId);
          console.log(`Job ${jobId} status: ${fineTuneStatus.status}`);
          console.log(`Training progress: ${fineTuneStatus.training_progress || 0}%`);
          
          if (fineTuneStatus.status === 'succeeded') {
            return fineTuneStatus;
          }
          
          if (fineTuneStatus.status === 'failed') {
            console.log('Fine-tuning failed:', fineTuneStatus.error || 'Unknown error');
            throw new Error('Fine-tuning failed');
          }
          
          await new Promise(resolve => setTimeout(resolve, checkInterval));
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw error;
          }
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, retryCount) * 1000)
          );
        }
      }
      throw new Error('Fine-tuning timeout');
    } catch (error) {
      console.log('Error checking fine-tune status:', error);
      throw error;
    }
  }
}

exports.OpenAIProvider = new OpenAIProvider();