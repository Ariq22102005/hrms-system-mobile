// Keep Android's offscreen WebView alive until Expo's PDF callback completes.
// The upstream task is otherwise only a local variable and can be collected
// while suspended. https://developer.android.com/training/printing/html-docs
const fs = require('node:fs');
const path = require('node:path');
const dir = path.dirname(require.resolve('expo-print/package.json'));
const filename = path.join(dir, 'android/src/main/java/expo/modules/print/PrintModule.kt');
let source = fs.readFileSync(filename, 'utf8');
const marker = '// Aranus: retain offscreen render tasks until completion.';
if (source.includes(marker)) process.exit(0);
function replace(before, after) {
  if (!source.includes(before)) throw new Error('expo-print changed: review Android PDF compatibility patch before building.');
  source = source.replace(before, after);
}
replace('  private val jobName = "Printing"', `  private val jobName = "Printing"\n  ${marker}\n  private val activeRenderTasks = mutableSetOf<PrintPDFRenderTask>()`);
replace('createPrintCallbacks(options, continuation)', 'createPrintCallbacks(options, continuation, renderTask)');
replace('createPrintToFileCallbacks(options, continuation)', 'createPrintToFileCallbacks(options, continuation, renderTask)');
const declaration = 'val renderTask = PrintPDFRenderTask(context, options)';
if (source.split(declaration).length !== 3) throw new Error('Expected two expo-print render entry points.');
source = source.replaceAll(declaration, `${declaration}\n        activeRenderTasks.add(renderTask)`);
replace('continuation: Continuation<FilePrintResult>): PrintPDFRenderTask.Callbacks', 'continuation: Continuation<FilePrintResult>, renderTask: PrintPDFRenderTask): PrintPDFRenderTask.Callbacks');
replace('continuation: Continuation<Unit>): PrintPDFRenderTask.Callbacks', 'continuation: Continuation<Unit>, renderTask: PrintPDFRenderTask): PrintPDFRenderTask.Callbacks');
source = source.replaceAll('override fun onRenderFinished(document: PrintDocumentAdapter, outputFile: File?, numberOfPages: Int) {', 'override fun onRenderFinished(document: PrintDocumentAdapter, outputFile: File?, numberOfPages: Int) {\n        activeRenderTasks.remove(renderTask)');
source = source.replaceAll('override fun onRenderError(exception: CodedException) {', 'override fun onRenderError(exception: CodedException) {\n        activeRenderTasks.remove(renderTask)');
fs.writeFileSync(filename, source);
console.log('Applied Android expo-print WebView lifetime fix.');
