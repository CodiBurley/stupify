// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { Configuration, OpenAIApi } from "openai";
import systemPrompt from "./prompt/system.txt";

let newDocumentUri: vscode.Uri; // Variable to store the new document Uri

function initializeOpenAI() {
  const configuration = new Configuration({
    apiKey: vscode.workspace.getConfiguration().get("stupify.openAIApiKey"),
  });
  return new OpenAIApi(configuration);
}

async function openNewTextDocumentWithSameLanguage() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(
      "Please open a file and show me some code"
    );
    return;
  }
  const document = editor.document;
  const language = document.languageId;
  const doc = await vscode.workspace.openTextDocument({ language });
  newDocumentUri = doc.uri; // Store the Uri of the newly created document
  await vscode.window.showTextDocument(doc, editor.viewColumn);
}

let lastEdit = Promise.resolve(true);
async function appendTextToActiveEditor(text: string) {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const document = editor.document;
    const lastLine = document.lineAt(document.lineCount - 1);
    const range = new vscode.Range(lastLine.range.start, lastLine.range.end);
    const edit = vscode.TextEdit.insert(range.end, text);
    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.set(document.uri, [edit]);

    // Chain the promise
    lastEdit = lastEdit.then(() => vscode.workspace.applyEdit(workspaceEdit));
    await lastEdit;
  }
}

async function appendResponseStreamToNewFile(
  response: Awaited<
    ReturnType<typeof OpenAIApi.prototype.createChatCompletion>
  >,
  originalDocumentUri: vscode.Uri | undefined
) {
  await openNewTextDocumentWithSameLanguage();
  for await (const data of response.data as any) {
    const lines = data
      .toString("utf-8")
      .split("\n")
      .filter((line: string) => line.trim() !== "");
    for (const line of lines) {
      const message = line.replace(/^data: /, "");
      try {
        const parsed = JSON.parse(message);
        if (Boolean(parsed.choices[0]?.finish_reason)) {
          // finish logic here
          continue;
        }
        const content = parsed.choices[0]?.delta?.content;
        if (!content) {
          continue;
        }
        await appendTextToActiveEditor(content);
      } catch (error) {
        console.error("Could not JSON parse stream message", message, error);
      }
    }
  }
  // Open diff view after the new document has been written
  await vscode.commands.executeCommand(
    "vscode.diff",
    originalDocumentUri,
    newDocumentUri,
    "Diff view"
  );
}

function removeExtraNewlines(content: string) {
  return content.replace(/\n{2,}/g, "\n");
}

function getValidatedTextFromActiveEditor() {
  const MINIMUM_LENGTH = 120;

  const currentFileContent = vscode.window.activeTextEditor?.document.getText();

  if (!currentFileContent || currentFileContent.length < MINIMUM_LENGTH) {
    vscode.window.showInformationMessage(
      "Please provide more code to work with"
    );
    return;
  }

  return removeExtraNewlines(currentFileContent);
}

async function getRefactorAICompletionResponseStream(
  currentFileContent: string
) {
  const openai = initializeOpenAI();
  return openai.createChatCompletion(
    {
      model:
        vscode.workspace.getConfiguration().get("stupify.openAIVersion") ??
        "gpt-3.5-turbo",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: currentFileContent,
        },
      ],
      temperature: 0,
    },
    { responseType: "stream" }
  );
}
export async function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "stupify.refactorViewModel",
    async () => {
      const currentFileContent = getValidatedTextFromActiveEditor();
      if (!currentFileContent) {
        return;
      }
      const originalDocumentUri = vscode.window.activeTextEditor?.document.uri; // Store the Uri of the original document
      const refactorResponseStream =
        await getRefactorAICompletionResponseStream(currentFileContent);
      await appendResponseStreamToNewFile(
        refactorResponseStream,
        originalDocumentUri
      );
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
