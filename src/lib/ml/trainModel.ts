import fs from 'fs';
import path from 'path';

export interface TrainingResult {
  success: boolean;
  message: string;
  datasetSize: number;
  newCoefficients?: Record<string, number>;
  intercept?: number;
}

// Sigmoid function
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/**
 * Trains a simple logistic regression model using gradient descent from scratch.
 * @param csvData Raw CSV string containing headers: income, spending, debtToIncome, missedPayments, target
 */
export async function trainModel(csvData: string): Promise<TrainingResult> {
  try {
    const lines = csvData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      throw new Error("Dataset is too small or empty.");
    }

    const headers = lines[0].split(',').map(h => h.trim());
    
    // Validate headers
    const requiredHeaders = ['income', 'spending', 'debtToIncome', 'missedPayments', 'target'];
    for (const req of requiredHeaders) {
      if (!headers.includes(req)) {
        throw new Error(`Missing required column: ${req}`);
      }
    }

    // Extract data
    const X: number[][] = [];
    const y: number[] = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => parseFloat(v.trim()));
      
      const income = vals[headers.indexOf('income')] || 0;
      const spending = vals[headers.indexOf('spending')] || 0;
      const debtToIncome = vals[headers.indexOf('debtToIncome')] || 0;
      const missedPayments = vals[headers.indexOf('missedPayments')] || 0;
      const target = vals[headers.indexOf('target')] || 0;

      // Scale income and spending roughly to avoid exploding gradients
      X.push([income / 10000, spending / 10000, debtToIncome, missedPayments]);
      y.push(target);
    }

    const m = X.length; // number of samples
    const n = 4; // number of features
    
    // Initialize weights and bias
    let weights = [0, 0, 0, 0];
    let bias = 0;
    
    // Hyperparameters
    const learningRate = 0.01;
    const epochs = 1000;

    // Gradient Descent
    for (let epoch = 0; epoch < epochs; epoch++) {
      let dw = [0, 0, 0, 0];
      let db = 0;
      
      for (let i = 0; i < m; i++) {
        // Forward pass
        const z = (X[i][0] * weights[0]) + (X[i][1] * weights[1]) + (X[i][2] * weights[2]) + (X[i][3] * weights[3]) + bias;
        const a = sigmoid(z);
        
        // Calculate gradients
        const dz = a - y[i];
        
        for (let j = 0; j < n; j++) {
          dw[j] += X[i][j] * dz;
        }
        db += dz;
      }
      
      // Update weights and bias
      for (let j = 0; j < n; j++) {
        weights[j] -= learningRate * (dw[j] / m);
      }
      bias -= learningRate * (db / m);
    }

    // Rescale weights for income and spending back to original scale interpretation
    const finalCoefficients = {
      income: weights[0] / 10000,
      spending: weights[1] / 10000,
      debtToIncome: weights[2],
      missedPayments: weights[3]
    };

    const modelData = {
      intercept: bias,
      coefficients: finalCoefficients,
      lastTrained: new Date().toISOString(),
      datasetSize: m
    };

    // Save to modelCoefficients.json
    const filePath = path.join(process.cwd(), 'src', 'lib', 'ml', 'modelCoefficients.json');
    fs.writeFileSync(filePath, JSON.stringify(modelData, null, 2), 'utf-8');

    return {
      success: true,
      message: "Model trained successfully",
      datasetSize: m,
      newCoefficients: finalCoefficients,
      intercept: bias
    };

  } catch (error: any) {
    console.error("Training error:", error);
    return {
      success: false,
      message: error.message || "Failed to train model",
      datasetSize: 0
    };
  }
}
