// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { Configuration, OpenAIApi } from "openai";

const systemPrompt = `
You are a developer whose job is to extract all logic to do with data, state, effects, or computed properties to a function named useViewModel. Do your best to simplify, flatten, and refactor functions and rename variables to make the code more clear. Make sure to define the useViewModel function Props type in typescript in the same file. Only respond with code, do not wrap it in backticks. Use the following examples when considering how to respond:

Existing:
\`\`\`;
function MyComponent({ firstName, lastName, phoneNumber, id }) {
  const [state, setState] = useState(0);
  const computedProperty = state % 2 === 0 ? "even" : "odd";
  const suggestedEmail = \`\${firstName}.\${lastName}@email.com\`;
  const handleClick = () => {
    setState(state + 1);
  };
  return (
    <div>
      <h1>My Component {id}</h1>
      <p>My component is the best component</p>
      <button onClick={handleClick}>Increment</button>
      <div>{state}</div>
      {computedProperty === "even" ? (
        <p>My component is even</p>
      ) : (
        <p>My component is odd</p>
      )}
      <div>{suggestedEmail}</div>
      <div>{\`\${phoneNumber.slice(0, 3)}-\${phoneNumber.slice(
        3,
        6
      )}-\${phoneNumber.slice(6, 10)}\`}</div>
    </div>
  );
}
\`\`\`
Extracted:
\`\`\`;
type Props = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  id: number;
};
function MyComponentRoot({
  state,
  setState,
  computedProperty,
  suggestedEmail,
  formattedPhoneNumber,
  id,
}: ReturnType<typeof useViewModel>) {
  const handleClick = () => {
    setState(state + 1);
  };
  return (
    <div>
      <h1>My Component {id}</h1>
      <p>My component is the best component</p>
      <button onClick={handleClick}>Increment</button>
      <div>{state}</div>
      {computedProperty === "even" ? (
        <p>My component is even</p>
      ) : (
        <p>My component is odd</p>
      )}
      <div>{suggestedEmail}</div>
      <div>{formattedPhoneNumber}</div>
    </div>
  );
}
function useViewModel({ firstName, lastName, phoneNumber, id }: Props) {
  const [state, setState] = useState(0);
  const computedProperty = state % 2 === 0 ? "even" : "odd";
  const suggestedEmail = \`\${firstName}.\${lastName}@email.com\`;
  const formattedPhoneNumber = \`\${phoneNumber.slice(0, 3)}-\${phoneNumber.slice(
    3,
    6
  )}-\${phoneNumber.slice(6, 10)}\`;
  return {
    state,
    setState,
    computedProperty,
    suggestedEmail,
    formattedPhoneNumber,
    id,
  };
}
function MyComponent(props: Props) {
  return <MyComponentRoot {...useViewModel(props)} />;
}
\`\`\`
`;

const prompt = `
import { Bar, Flex, Grid, Text } from '../../../../components'
import './styles.scss'
import formatClasses from '../../../../utils/classes/formatClasses'
import { RuntimeCost } from '../../../../types/thermostatCostHistory'

export interface Props {
  period: string
  heat: RuntimeCost
  cool: RuntimeCost
  off: RuntimeCost
}

interface LegendItemProps {
  label: string
  subheading?: string
}

function LegendItem(props: LegendItemProps) {
  return (
    <Grid gap="6px" placeItems="baseline">
      <span data-temperature-key={props.label.toLowerCase()} />
      <Grid flow="row">
        <Text>{props.label}</Text>
        {props.subheading && <Text variant="body2">{props.subheading}</Text>}
      </Grid>
    </Grid>
  )
}

export default function HeatingCoolingCostsBar(props: Props) {
  const classes = formatClasses(['heating-cooling-bar'])

  const calculateWidth = (hours?: number) => {
    let period: number

    switch (props.period) {
      case 'day':
      default:
        period = 24
        break
      case 'week':
        period = 168
        break
      case 'month':
        period = 730
        break
    }

    return {
      width:  \`\${(hours || 0 / period) * 100}%\`,
    }
  }

  return (
    <Flex container spacing={2}>
      <Flex item style={{ width: '100%' }}>
        <Bar className={classes} size="lg">
          <div
            data-progress-key="cool"
            data-value={
              props?.cool?.runtime_hours ? props.cool.runtime_hours : undefined
            }
            style={calculateWidth(props?.cool?.runtime_hours)}
          />
          <div
            data-progress-key="heat"
            data-value={
              props?.heat?.runtime_hours ? props.heat.runtime_hours : undefined
            }
            style={calculateWidth(props?.heat?.runtime_hours)}
          />
        </Bar>
      </Flex>
      <Flex item>
        <Grid gap="16px">
          <LegendItem
            label="Cool"
            subheading={\`$\${props?.cool?.cost_cents || 0} • \${
              props?.cool?.runtime_hours || 0
            } hrs\`}
          />
          <LegendItem
            label="Heat"
            subheading={\`$\${props?.heat?.cost_cents || 0} • \${
              props?.heat?.runtime_hours || 0
            } hrs\`}
          />
          <LegendItem label="Off" />
        </Grid>
      </Flex>
    </Flex>
  )
}
`;

function initializeOpenAI() {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY ?? "",
  });
  return new OpenAIApi(configuration);
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

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "stupify" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "stupify.helloWorld",
    async () => {
      const openai = initializeOpenAI();
      const response = await openai.createChatCompletion(
        {
          model: "gpt-3.5-turbo",
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        },
        { responseType: "stream" }
      );
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
            console.error(
              "Could not JSON parse stream message",
              message,
              error
            );
          }
        }
      }
      vscode.window.showInformationMessage(JSON.stringify(response));
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
