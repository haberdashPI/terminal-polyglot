// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path'
import { TextDecoder } from 'util';

function with_editor(fn: (editor: vscode.TextEditor) => void){
  let editor = vscode.window.activeTextEditor;
  if(!editor){
    vscode.window.showErrorMessage("No active text editor.");
  }else{
    fn(editor);
  }
}

function with_file_path(editor: vscode.TextEditor,fn: (path: string) => void) {
    let uri = editor.document.uri;
    if(uri.scheme !== "file"){
      vscode.window.showErrorMessage("Current file is not local to this filesystem");
    }else{
      fn(uri.fsPath);
    }
}

function find_terminal(terminal_name: string){
  for(let term of vscode.window.terminals){
    if(term.name === terminal_name){ return term; }
  }
  return undefined;
}

function get_terminal(context: vscode.ExtensionContext,
    editor: vscode.TextEditor,file: string) {

  var state: {[key: string]: string;} = context.workspaceState.get('terminal-map') || {};

  let config = vscode.workspace.getConfiguration("terminal-run-cd.language-config");
  let languageId = editor.document.languageId;
  let terminal_name = state[file] || state[languageId];
  let terminal = (terminal_name === undefined) ? find_terminal(terminal_name) :
    vscode.window.createTerminal(languageId);
  if(terminal === undefined){
    vscode.window.showErrorMessage("Error creating a terminal.");
  }else{
    if(state[languageId] === undefined){ state[languageId] = terminal.name; }
    context.workspaceState.update('terminal-map',state);
  }

  return terminal;
}

interface TermLanguageConfig {
  cd: string;
  run: string;
}

function language_config(editor: vscode.TextEditor){
  let config = vscode.workspace.getConfiguration("terminal-run-cd.language-config");

  let l_config: TermLanguageConfig | undefined = config.get(editor.document.languageId);
  if(l_config){
    return l_config;
  }else{
    return {cd: "cd \"%\"", run: "./\"%\""};
  }
}

function replace_wildcard(pattern: string,val: string) {
  // the wildcard pattern is a single '%' with no neighboring '%'
  // this allows us to escape the wildcard character
  let wildcard = /([^%]|^)(%)([^%]|$)/;
  let escaped_wildcard = /%%/;

  return pattern.replace(wildcard,(_,prefix,match,suffix) => {
    return prefix+val+suffix;
  }).replace(escaped_wildcard,'%');
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('"terminal-run-cd" is now active!');

	// Change directory, as if we were in a bash or DOS terminal
	let command = vscode.commands.registerCommand('terminal-run-cd.global_cd', () => {
    with_editor(editor => {
      with_file_path(editor, file => {
        let dir = path.dirname(file);
        let terminal = get_terminal(context,file)
        terminal.sendText('cd "' + dir + '"');
        terminal.show();
      });
    });
  });
  context.subscriptions.push(command);

  command = vscode.commands.registerCommand('terminal-run-cd.cd', () => {
    with_editor(editor => {
      with_file_path(editor, file => {
        let dir = path.dirname(file);
        let pattern = language_config(editor).cd;
        let terminal = get_terminal(context);
        terminal.sendText(replace_wildcard(pattern,dir));
        terminal.show();
      });
    });
  });

  command = vscode.commands.registerCommand('terminal-run-cd.run', () => {
    with_editor(editor => {
      with_file_path(editor, file => {
        let pattern = language_config(editor).run;
        let terminal = get_terminal(context);
        terminal.sendText(replace_wildcard(pattern,file));
        terminal.show();
      });
    });
  });
}

// this method is called when your extension is deactivated
export function deactivate() {}
